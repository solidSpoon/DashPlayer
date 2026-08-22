import { inject, injectable } from 'inversify';
import { randomUUID } from 'node:crypto';
import { isStepCount, ModelMessage, Output, streamText, toUIMessageStream, tool, UIMessageChunk } from 'ai';
import { z } from 'zod';
import { getMainLogger } from '@/backend/infrastructure/logger';
import RendererGateway from '@/backend/services/gateways/renderer/RendererGateway';
import TYPES from '@/backend/ioc/types';
import AiProviderService from '@/backend/services/AiProviderService';
import {
    ChatSessionCreateParams,
    ChatSessionCreateResult,
    ChatStartResult,
    ChatWelcomeParams,
} from '@/common/types/chat';
import type { ChatReasoningEffort } from '@/common/types/chat';
import { AnalysisStartParams, AnalysisStartResult, DeepPartial } from '@/common/types/analysis';
import { AiUnifiedAnalysisRes, AiUnifiedAnalysisSchema } from '@/common/types/aiRes/AiUnifiedAnalysisRes';
import { WithRateLimit } from '@/backend/utils/concurrency/decorators';
import {
    appendBackgroundMessage,
    buildAnalysisPrompt,
    buildWelcomeMessages,
    splitSystemMessages,
} from '@/backend/services/chat/ChatPromptBuilder';
import ChatSessionStore from '@/backend/services/chat/ChatSessionStore';
import CacheService from '@/backend/services/CacheService';

export default interface ChatSessionService {
    create(params: ChatSessionCreateParams): ChatSessionCreateResult;
    close(sessionId: string): void;
    stop(sessionId: string): void;
    start(sessionId: string, content: string, reasoningEffort?: ChatReasoningEffort): Promise<ChatStartResult>;
    startWelcome(params: ChatWelcomeParams): Promise<ChatStartResult>;
    startAnalysis(params: AnalysisStartParams): Promise<AnalysisStartResult>;
}


@injectable()
export class ChatSessionServiceImpl implements ChatSessionService {
    private logger = getMainLogger('ChatSessionService');

    @inject(TYPES.AiProviderService)
    private aiProviderService!: AiProviderService;

    @inject(TYPES.RendererGateway)
    private rendererGateway!: RendererGateway;

    @inject(TYPES.ChatSessionStore)
    private chatSessionStore!: ChatSessionStore;

    @inject(TYPES.CacheService)
    private cacheService!: CacheService;

    /**
     * 创建由 main 进程持有的内存会话。
     * @param params 视频、主题与字幕上下文快照。
     * @returns 后端生成的会话 ID。
     */
    public create(params: ChatSessionCreateParams): ChatSessionCreateResult {
        return { sessionId: this.chatSessionStore.create(params).id };
    }

    /**
     * 关闭会话并取消其全部未完成生成。
     * @param sessionId 要关闭的会话 ID。
     */
    public close(sessionId: string): void {
        this.chatSessionStore.close(sessionId);
    }

    /**
     * 取消会话中的当前生成，但保留会话供后续继续使用。
     * @param sessionId 要停止运行的会话 ID。
     */
    public stop(sessionId: string): void {
        this.chatSessionStore.stop(sessionId);
    }

    /**
     * 根据会话创建时冻结的主题生成欢迎消息。
     * @param sessionId 会话 ID。
     * @returns 新 assistant 消息的 ID。
     */
    @WithRateLimit('gpt')
    public async startWelcome(params: ChatWelcomeParams): Promise<ChatStartResult> {
        const sessionId = params.sessionId;
        const messageId = this.createMessageId();
        const model = this.aiProviderService.getModel('sentenceLearning');
        if (!model) {
            this.rendererGateway.fireAndForget('chat/stream', {
                sessionId,
                chunk: { type: 'error', errorText: 'OpenAI api key or endpoint is empty' },
            });
            return { messageId };
        }

        const session = this.chatSessionStore.get(sessionId);
        const messages = buildWelcomeMessages({
            sessionId,
            originalTopic: session.originalTopic,
            fullText: session.paragraphLines.join(' '),
            subtitleOverview: this.getSubtitleOverview(session.subtitleFileHash, session.anchorSentenceIndex),
        });
        this.startTextRun(sessionId, messageId, messages, 'welcome', params.reasoningEffort ?? 'medium');

        return { messageId };
    }

    /**
     * 启动当前会话主题的结构化句子分析。
     * @param params 会话 ID；text 仅保留在旧契约中，实际主题从会话快照读取。
     * @returns 本次分析消息 ID。
     */
    @WithRateLimit('gpt')
    public async startAnalysis(params: AnalysisStartParams): Promise<AnalysisStartResult> {
        const messageId = this.createMessageId();
        const sessionId = params.sessionId;
        this.rendererGateway.fireAndForget('chat/analysis/stream', {
            sessionId,
            messageId,
            chunk: { type: 'start', messageId },
        });

        const model = this.aiProviderService.getModel('sentenceLearning');
        if (!model) {
            this.rendererGateway.fireAndForget('chat/analysis/stream', {
                sessionId,
                messageId,
                chunk: { type: 'error', errorText: 'OpenAI api key or endpoint is empty' },
            });
            return { messageId };
        }

        const prompt = buildAnalysisPrompt(this.chatSessionStore.get(sessionId).originalTopic);
        const abortSignal = this.chatSessionStore.startRun(sessionId, messageId);
        this.runAnalysisStream(sessionId, messageId, prompt, abortSignal)
            .catch((error) => this.handleAnalysisError(sessionId, messageId, error))
            .finally(() => this.chatSessionStore.finishRun(sessionId, messageId));

        return { messageId };
    }

    /**
     * 向会话追加用户消息并基于 main 进程持有的历史启动回答。
     * @param sessionId 会话 ID。
     * @param content 新增的用户文本。
     * @param reasoningEffort 本次回答的推理强度，未传时使用中档。
     * @returns 新 assistant 消息的 ID。
     */
    @WithRateLimit('gpt')
    public async start(
        sessionId: string,
        content: string,
        reasoningEffort: ChatReasoningEffort = 'medium',
    ): Promise<ChatStartResult> {
        const messageId = this.createMessageId();
        this.chatSessionStore.appendMessage(sessionId, { role: 'user', content });
        const session = this.chatSessionStore.get(sessionId);
        const enrichedMessages = appendBackgroundMessage(
            [...session.messages],
            {
                ...this.chatSessionStore.getBackground(sessionId),
                subtitleOverview: this.getSubtitleOverview(session.subtitleFileHash, session.anchorSentenceIndex),
            },
        );
        const model = this.aiProviderService.getModel('sentenceLearning');
        if (!model) {
            this.rendererGateway.fireAndForget('chat/stream', {
                sessionId,
                chunk: { type: 'error', errorText: 'OpenAI api key or endpoint is empty' },
            });
            return { messageId };
        }

        this.startTextRun(sessionId, messageId, enrichedMessages, 'chat', reasoningEffort);

        return { messageId };
    }

    /**
     * 登记可取消运行并在后台消费文本流。
     * @param sessionId 会话 ID。
     * @param messageId assistant 消息 ID。
     * @param messages 本次发送给模型的消息。
     * @param runType 日志中的运行类型。
     */
    private startTextRun(
        sessionId: string,
        messageId: string,
        messages: ModelMessage[],
        runType: 'welcome' | 'chat',
        reasoningEffort: ChatReasoningEffort,
    ): void {
        const abortSignal = this.chatSessionStore.startRun(sessionId, messageId);
        this.runStream(sessionId, messageId, messages, abortSignal, reasoningEffort)
            .catch((error) => this.handleTextError(sessionId, messageId, runType, error))
            .finally(() => this.chatSessionStore.finishRun(sessionId, messageId));
    }

    /**
     * 使用 AI SDK 消费文本流，并在成功完成后把 assistant 消息写入会话历史。
     * @param sessionId 会话 ID。
     * @param messageId assistant 消息 ID。
     * @param messages 本次模型消息。
     * @param abortSignal 会话生命周期对应的取消信号。
     * @param reasoningEffort 本次回答的推理强度。
     */
    private async runStream(
        sessionId: string,
        messageId: string,
        messages: ModelMessage[],
        abortSignal: AbortSignal,
        reasoningEffort: ChatReasoningEffort,
    ): Promise<void> {
        const model = this.aiProviderService.getModel('sentenceLearning', reasoningEffort);
        if (!model) {
            return;
        }
        // v7 起 system 不能放在 messages 里，需拆出来走 system 参数，否则流会静默空转
        const { system, messages: promptMessages } = splitSystemMessages(messages);
        // 生命周期日志记 info：生产环境默认 info 级，只有这样"流是否开始/完成、生成了多少 chunk"才可回溯。
        this.logger.info('chat stream start', { sessionId, messageId });
        const result = streamText({
            model,
            system,
            messages: promptMessages,
            tools: this.buildSubtitleTools(sessionId),
            stopWhen: isStepCount(5),
            abortSignal,
        });
        let chunkCount = 0;
        let content = '';
        let aborted = false;
        const uiStream = toUIMessageStream({
            stream: result.stream,
            generateMessageId: () => messageId,
            onError: (error) => error instanceof Error ? error.message : String(error),
        });
        for await (const chunk of uiStream) {
            chunkCount += 1;
            if (chunk.type === 'text-delta') {
                content += chunk.delta;
            }
            if (chunk.type === 'abort') {
                aborted = true;
            }
            this.rendererGateway.fireAndForget('chat/stream', {
                sessionId,
                chunk,
            });
        }
        if (!aborted) {
            this.chatSessionStore.appendMessage(sessionId, { role: 'assistant', content });
        }
        this.logger.info('chat stream done', { sessionId, messageId, chunkCount });
    }

    /**
     * 创建不可预测的消息标识。
     * @returns UUID 消息 ID。
     */
    private createMessageId(): string {
        return randomUUID();
    }

    /**
     * 创建整句学习聊天可调用的字幕工具。
     * 工具只暴露字幕索引和窗口大小，具体缓存定位由后端会话完成；所有结果都限制为精简字幕投影。
     * @param sessionId 当前整句学习会话 ID。
     * @returns AI SDK 工具集合。
     */
    private buildSubtitleTools(sessionId: string) {
        const getSentences = () => {
            const session = this.chatSessionStore.get(sessionId);
            const cached = this.cacheService.get('cache:srt', session.subtitleFileHash);
            if (!cached) {
                throw new Error('当前会话的字幕缓存不存在');
            }
            return cached.sentences;
        };

        const projectSentence = (sentence: {
            index: number;
            start: number;
            end: number;
            text: string;
        }) => ({
            index: sentence.index,
            start: sentence.start,
            end: sentence.end,
            text: sentence.text,
        });

        return {
            search_subtitles: tool({
                description: '在当前视频的完整字幕中搜索一个或多个关键词，返回命中字幕的索引、时间和文本。默认任意关键词命中即可。',
                inputSchema: z.object({
                    queries: z.array(z.string().trim().min(1)).min(1).max(5),
                    match: z.enum(['any', 'all']).default('any'),
                    limit: z.number().int().min(1).max(20).default(10),
                    skip: z.number().int().min(0).max(10000).default(0),
                }),
                execute: async ({ queries, match, limit, skip }) => {
                    const normalizedQueries = queries.map((query) => query.toLowerCase());
                    const allMatches = getSentences()
                        .map((sentence) => {
                            const text = sentence.text.toLowerCase();
                            const matchedQueries = normalizedQueries.filter((query) => text.includes(query));
                            return matchedQueries.length > 0 && (match === 'any' || matchedQueries.length === normalizedQueries.length)
                                ? { ...projectSentence(sentence), matchedQueries }
                                : null;
                        })
                        .filter((sentence): sentence is NonNullable<typeof sentence> => sentence !== null)
                    return {
                        matches: allMatches.slice(skip, skip + limit),
                        total: allMatches.length,
                        skip,
                        limit,
                    };
                },
            }),
            get_subtitle_context: tool({
                description: '根据字幕索引读取该句附近的连续字幕。返回结果以目标索引为中心，limit 是返回总条数。',
                inputSchema: z.object({
                    index: z.number().int().min(0),
                    limit: z.number().int().min(1).max(50).default(20),
                }),
                execute: async ({ index, limit }) => {
                    const sentences = getSentences();
                    const anchorPosition = sentences.findIndex((sentence) => sentence.index === index);
                    if (anchorPosition < 0) {
                        throw new Error(`字幕索引不存在：${index}`);
                    }
                    const size = Math.min(limit, sentences.length);
                    const before = Math.floor((size - 1) / 2);
                    const start = Math.max(0, Math.min(anchorPosition - before, sentences.length - size));
                    const items = sentences.slice(start, start + size).map(projectSentence);
                    return {
                        anchorIndex: index,
                        startIndex: items[0]?.index ?? index,
                        endIndex: items.at(-1)?.index ?? index,
                        items,
                    };
                },
            }),
        };
    }

    /**
     * 从后端字幕缓存生成给 Agent 的全局概览，避免把完整字幕正文重复塞进提示词。
     * @param subtitleFileHash 当前会话绑定的字幕缓存键。
     * @param anchorIndex 当前学习句的字幕索引。
     * @returns 字幕行数、字符数和索引范围。
     */
    private getSubtitleOverview(
        subtitleFileHash: string,
        anchorIndex: number,
    ) {
        const cached = this.cacheService.get('cache:srt', subtitleFileHash);
        if (!cached || cached.sentences.length === 0) {
            throw new Error('当前会话的字幕缓存不存在或为空');
        }
        const indexes = cached.sentences.map((sentence) => sentence.index);
        return {
            lineCount: cached.sentences.length,
            characterCount: cached.sentences.reduce((total, sentence) => total + Array.from(sentence.text).length, 0),
            minIndex: Math.min(...indexes),
            maxIndex: Math.max(...indexes),
            anchorIndex,
        };
    }


    /**
     * 生成结构化分析，partial 仅用于即时展示，最终校验结果才写入会话。
     * @param sessionId 会话 ID。
     * @param messageId 分析消息 ID。
     * @param prompt 分析提示词。
     * @param abortSignal 会话生命周期对应的取消信号。
     */
    private async runAnalysisStream(
        sessionId: string,
        messageId: string,
        prompt: string,
        abortSignal: AbortSignal,
    ): Promise<void> {
        const model = this.aiProviderService.getModel('sentenceLearning');
        if (!model) {
            return;
        }
        const streamLogger = this.logger;
        streamLogger.info('analysis stream start', { sessionId, messageId });
        const result = streamText({
            model,
            output: Output.object({ schema: AiUnifiedAnalysisSchema }),
            prompt,
            abortSignal,
        });
        let chunkCount = 0;
        for await (const partial of result.partialOutputStream) {
            chunkCount += 1;
            // chunk 频率极高，仅首 chunk 与每 20 个采样一次，避免逐 chunk 刷屏。
            if (chunkCount === 1 || chunkCount % 20 === 0) {
                streamLogger.debug('analysis stream chunk', {
                    sessionId,
                    messageId,
                    chunkCount,
                    keys: Object.keys(partial ?? {}),
                });
            }
            this.rendererGateway.fireAndForget('chat/analysis/stream', {
                sessionId,
                messageId,
                chunk: {
                    type: 'data-analysis',
                    id: messageId,
                    data: this.normalizeAnalysisPartial(partial),
                },
            });
        }
        streamLogger.info('analysis stream done', { sessionId, messageId, chunkCount });
        const finalObject = await result.output;
        this.chatSessionStore.setAnalysis(sessionId, finalObject);
        streamLogger.debug('analysis stream done', { sessionId, messageId });
        this.rendererGateway.fireAndForget('chat/analysis/stream', {
            sessionId,
            messageId,
            chunk: { type: 'data-analysis', id: messageId, data: finalObject },
        });
        this.rendererGateway.fireAndForget('chat/analysis/stream', {
            sessionId,
            messageId,
            chunk: { type: 'finish', finishReason: 'stop' },
        });
    }

    /**
     * 将文本生成失败区分为主动取消和真实错误，并发送对应生命周期事件。
     * @param sessionId 会话 ID。
     * @param messageId 消息 ID。
     * @param runType 运行类型。
     * @param error 捕获到的异常。
     */
    private handleTextError(
        sessionId: string,
        messageId: string,
        runType: 'welcome' | 'chat',
        error: unknown,
    ): void {
        const cancelled = this.isCancellation(error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!cancelled) {
            this.logger.error(`${runType} stream failed`, { error: errorMessage });
        }
        const chunk: UIMessageChunk = cancelled
            ? { type: 'abort', reason: '用户已取消生成' }
            : { type: 'error', errorText: errorMessage };
        this.rendererGateway.fireAndForget('chat/stream', { sessionId, chunk });
    }

    /**
     * 将分析失败区分为主动取消和真实错误。
     * @param sessionId 会话 ID。
     * @param messageId 分析消息 ID。
     * @param error 捕获到的异常。
     */
    private handleAnalysisError(sessionId: string, messageId: string, error: unknown): void {
        const cancelled = this.isCancellation(error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!cancelled) {
            this.logger.error('analysis stream failed', { error: errorMessage });
        }
        this.rendererGateway.fireAndForget('chat/analysis/stream', {
            sessionId,
            messageId,
            chunk: cancelled
                ? { type: 'abort', reason: '用户已取消分析' }
                : { type: 'error', errorText: errorMessage },
        });
    }

    /**
     * 判断异常是否由 AbortSignal 主动取消产生。
     * @param error 捕获到的异常。
     * @returns 属于取消语义时为 true。
     */
    private isCancellation(error: unknown): boolean {
        return error instanceof Error
            && (error.name === 'AbortError' || /abort|cancel|closed/i.test(error.message));
    }

    private normalizeAnalysisPartial(
        partial: DeepPartial<AiUnifiedAnalysisRes>
    ): DeepPartial<AiUnifiedAnalysisRes> {
        const examples = partial.examples;
        const sentences = examples?.sentences;
        if (!examples || !Array.isArray(sentences)) {
            return partial;
        }

        const shouldNormalize = sentences.some((sentence) => typeof sentence === 'string');
        if (!shouldNormalize) {
            return partial;
        }

        const points = (examples as { points?: unknown }).points;
        const pointsList = Array.isArray(points) ? points : [];
        const normalizedSentences = sentences.map(
            (sentence: unknown, index): DeepPartial<AiUnifiedAnalysisRes['examples']['sentences'][number]> => {
                if (sentence && typeof sentence === 'object' && 'sentence' in sentence) {
                    const sentenceObj = sentence as {
                        sentence?: unknown;
                        meaning?: unknown;
                        points?: unknown;
                    };
                    const pointsValue = Array.isArray(sentenceObj.points)
                        ? sentenceObj.points.filter((point): point is string => typeof point === 'string')
                        : undefined;
                    return {
                        sentence: typeof sentenceObj.sentence === 'string' ? sentenceObj.sentence : undefined,
                        meaning: typeof sentenceObj.meaning === 'string' ? sentenceObj.meaning : undefined,
                        points: pointsValue,
                    };
                }
                const sentencePoints = Array.isArray(pointsList[index])
                    ? pointsList[index].filter((point): point is string => typeof point === 'string')
                    : [];
                return {
                    sentence: typeof sentence === 'string' ? sentence : '',
                    meaning: '',
                    points: sentencePoints,
                };
            }
        );

        const { points: _ignoredPoints, ...restExamples } = examples as {
            points?: unknown;
        };

        return {
            ...partial,
            examples: {
                ...restExamples,
                sentences: normalizedSentences,
            },
        };
    }
}
