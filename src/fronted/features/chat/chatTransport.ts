import { ChatTransport, UIMessage, UIMessageChunk } from 'ai';
import { chatApi } from '@/fronted/features/chat/chatApi';
import { getRendererLogger } from '@/fronted/log/simple-logger';

/**
 * Electron transport 当前正在消费的标准 UI 消息流。
 */
type ActiveChatStream = {
    /** UI SDK 提供的流控制器。 */
    controller: ReadableStreamDefaultController<UIMessageChunk>;
    /** 移除外部取消监听器。 */
    removeAbortListener: () => void;
    /** 当前流的前端观测起点与首个可见阶段。 */
    startedAt: number;
    firstReasoningAt: number | null;
    firstTextAt: number | null;
};

const logger = getRendererLogger('SentenceLearningTransport');

const activeStreams = new Map<string, ActiveChatStream>();

/**
 * 摘掉一个流的登记与取消监听。
 *
 * 说明：流走完、被用户取消或被后端取消之后再到的片段一律丢弃——往已经关闭的控制器里写会直接抛
 * TypeError，而这条路径跑在 IPC 事件回调里，抛出去就是一次没人接的异常。
 *
 * @param sessionId 会话 ID。
 */
const detachStream = (sessionId: string): void => {
    const active = activeStreams.get(sessionId);
    if (!active) {
        return;
    }
    active.removeAbortListener();
    activeStreams.delete(sessionId);
};

/**
 * 接收 main 进程推送的 AI SDK 标准消息片段并交给对应 transport。
 * @param sessionId 会话 ID。
 * @param chunk 标准 UI 消息片段。
 */
export const receiveChatChunk = (sessionId: string, chunk: UIMessageChunk): void => {
    const active = activeStreams.get(sessionId);
    if (!active) {
        return;
    }
    if (chunk.type === 'reasoning-delta' && active.firstReasoningAt === null) {
        active.firstReasoningAt = Date.now();
        logger.info('chat first reasoning chunk', { sessionId, elapsedMs: active.firstReasoningAt - active.startedAt });
    }
    if (chunk.type === 'text-delta' && active.firstTextAt === null) {
        active.firstTextAt = Date.now();
        logger.info('chat first text chunk', { sessionId, elapsedMs: active.firstTextAt - active.startedAt });
    }
    if (chunk.type === 'finish' || chunk.type === 'error' || chunk.type === 'abort') {
        logger.info('chat stream received terminal chunk', {
            sessionId,
            chunkType: chunk.type,
            elapsedMs: Date.now() - active.startedAt,
        });
    }
    active.controller.enqueue(chunk);
    if (chunk.type === 'finish' || chunk.type === 'error' || chunk.type === 'abort') {
        detachStream(sessionId);
        active.controller.close();
    }
};

/**
 * 通过 Electron IPC 连接 AI SDK React useChat 与 main 进程会话服务。
 */
export class ElectronChatTransport<CHAT_MESSAGE extends UIMessage = UIMessage>
    implements ChatTransport<CHAT_MESSAGE> {
    /**
     * 把 useChat 最新一条用户消息发送给 main，并返回标准 UIMessageChunk 流。
     * @param options AI SDK 提供的发送参数。
     * @returns 可由 useChat 直接消费的标准消息流。
     */
    public async sendMessages(
        options: Parameters<ChatTransport<CHAT_MESSAGE>['sendMessages']>[0],
    ): Promise<ReadableStream<UIMessageChunk>> {
        const sessionId = options.chatId;
        const lastMessage = options.messages.at(-1);
        const content = lastMessage?.parts
            .filter((part) => part.type === 'text')
            .map((part) => part.text)
            .join('') ?? '';

        return new ReadableStream<UIMessageChunk>({
            start: (controller) => {
                const abort = () => {
                    detachStream(sessionId);
                    chatApi.stopSession(sessionId).catch(() => undefined);
                };
                options.abortSignal?.addEventListener('abort', abort, { once: true });
                activeStreams.set(sessionId, {
                    controller,
                    removeAbortListener: () => options.abortSignal?.removeEventListener('abort', abort),
                    startedAt: Date.now(),
                    firstReasoningAt: null,
                    firstTextAt: null,
                });
                logger.info('chat stream request started', { sessionId });

                chatApi.start({ sessionId, content }).catch((error) => {
                    const active = activeStreams.get(sessionId);
                    if (!active) {
                        return;
                    }
                    active.controller.enqueue({
                        type: 'error',
                        errorText: error instanceof Error ? error.message : String(error),
                    });
                    detachStream(sessionId);
                    active.controller.close();
                });
            },
            cancel: () => {
                detachStream(sessionId);
                return chatApi.stopSession(sessionId);
            },
        });
    }

    /**
     * 内存会话暂不支持进程重启后的流重连。
     * @returns 固定返回 null，表示没有可恢复流。
     */
    public async reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
        return null;
    }
}
