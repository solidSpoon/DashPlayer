import { ChatTransport, UIMessage, UIMessageChunk } from 'ai';
import { chatApi } from '@/fronted/features/chat/chatApi';

/**
 * Electron transport 当前正在消费的标准 UI 消息流。
 */
type ActiveChatStream = {
    /** UI SDK 提供的流控制器。 */
    controller: ReadableStreamDefaultController<UIMessageChunk>;
    /** 移除外部取消监听器。 */
    removeAbortListener: () => void;
};

const activeStreams = new Map<string, ActiveChatStream>();

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
    active.controller.enqueue(chunk);
    if (chunk.type === 'finish' || chunk.type === 'error' || chunk.type === 'abort') {
        active.removeAbortListener();
        activeStreams.delete(sessionId);
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
     * @param options AI SDK 提供的发送参数；body.mode=welcome 时启动欢迎消息。
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
        const mode = (options.body as { mode?: unknown } | undefined)?.mode;

        return new ReadableStream<UIMessageChunk>({
            start: (controller) => {
                const abort = () => {
                    chatApi.stopSession(sessionId).catch(() => undefined);
                };
                options.abortSignal?.addEventListener('abort', abort, { once: true });
                activeStreams.set(sessionId, {
                    controller,
                    removeAbortListener: () => options.abortSignal?.removeEventListener('abort', abort),
                });

                const request = mode === 'welcome'
                    ? chatApi.getWelcome({ sessionId })
                    : chatApi.start({ sessionId, content });
                request.catch((error) => {
                    const active = activeStreams.get(sessionId);
                    if (!active) {
                        return;
                    }
                    active.controller.enqueue({
                        type: 'error',
                        errorText: error instanceof Error ? error.message : String(error),
                    });
                    active.removeAbortListener();
                    activeStreams.delete(sessionId);
                    active.controller.close();
                });
            },
            cancel: () => chatApi.stopSession(sessionId),
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
