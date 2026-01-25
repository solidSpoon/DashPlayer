import { inject, injectable } from 'inversify';
import { CoreMessage, streamObject, streamText } from 'ai';
import { getMainLogger } from '@/backend/infrastructure/logger';
import RendererGateway from '@/backend/application/ports/gateways/renderer/RendererGateway';
import TYPES from '@/backend/ioc/types';
import AiProviderService from '@/backend/application/services/AiProviderService';
import ChatSessionService from '@/backend/application/services/ChatSessionService';
import { ChatBackgroundContext, ChatStartResult, ChatWelcomeParams } from '@/common/types/chat';
import { AnalysisStartParams, AnalysisStartResult, DeepPartial } from '@/common/types/analysis';
import { AiUnifiedAnalysisRes, AiUnifiedAnalysisSchema } from '@/common/types/aiRes/AiUnifiedAnalysisRes';
import { WaitRateLimit } from '@/common/utils/RateLimiter';
import {
    appendBackgroundMessage,
    buildAnalysisPrompt,
    buildWelcomeMessages,
} from '@/backend/application/services/chat/ChatPromptBuilder';

@injectable()
export default class ChatSessionServiceImpl implements ChatSessionService {
    private logger = getMainLogger('ChatSessionService');

    @inject(TYPES.AiProviderService)
    private aiProviderService!: AiProviderService;

    @inject(TYPES.RendererGateway)
    private rendererGateway!: RendererGateway;

    @WaitRateLimit('gpt')
    public async startWelcome(params: ChatWelcomeParams): Promise<ChatStartResult> {
        const messageId = this.createMessageId();
        const sessionId = params.sessionId;
        this.rendererGateway.fireAndForget('chat/stream', {
            sessionId,
            messageId,
            event: 'start',
        });

        const model = this.aiProviderService.getModel();
        if (!model) {
            this.rendererGateway.fireAndForget('chat/stream', {
                sessionId,
                messageId,
                event: 'error',
                error: 'OpenAI api key or endpoint is empty',
            });
            return { messageId };
        }

        const messages = buildWelcomeMessages(params);
        this.runStream(sessionId, messageId, messages).catch((error) => {
            this.logger.error('welcome stream failed', {
                error: error instanceof Error ? error.message : String(error),
            });
            this.rendererGateway.fireAndForget('chat/stream', {
                sessionId,
                messageId,
                event: 'error',
                error: error instanceof Error ? error.message : String(error),
            });
        });

        return { messageId };
    }

    @WaitRateLimit('gpt')
    public async startAnalysis(params: AnalysisStartParams): Promise<AnalysisStartResult> {
        const messageId = this.createMessageId();
        const sessionId = params.sessionId;
        this.rendererGateway.fireAndForget('chat/analysis/stream', {
            sessionId,
            messageId,
            event: 'start',
        });

        const model = this.aiProviderService.getModel();
        if (!model) {
            this.rendererGateway.fireAndForget('chat/analysis/stream', {
                sessionId,
                messageId,
                event: 'error',
                error: 'OpenAI api key or endpoint is empty',
            });
            return { messageId };
        }

        const prompt = buildAnalysisPrompt(params.text);
        this.runAnalysisStream(sessionId, messageId, prompt).catch((error) => {
            this.logger.error('analysis stream failed', {
                error: error instanceof Error ? error.message : String(error),
            });
            this.rendererGateway.fireAndForget('chat/analysis/stream', {
                sessionId,
                messageId,
                event: 'error',
                error: error instanceof Error ? error.message : String(error),
            });
        });

        return { messageId };
    }

    @WaitRateLimit('gpt')
    public async start(
        sessionId: string,
        messages: CoreMessage[],
        background?: ChatBackgroundContext
    ): Promise<ChatStartResult> {
        const messageId = this.createMessageId();
        const enrichedMessages = appendBackgroundMessage(messages, background);
        this.rendererGateway.fireAndForget('chat/stream', {
            sessionId,
            messageId,
            event: 'start',
        });

        const model = this.aiProviderService.getModel();
        if (!model) {
            this.rendererGateway.fireAndForget('chat/stream', {
                sessionId,
                messageId,
                event: 'error',
                error: 'OpenAI api key or endpoint is empty',
            });
            return { messageId };
        }

        this.runStream(sessionId, messageId, enrichedMessages).catch((error) => {
            this.logger.error('chat stream failed', {
                error: error instanceof Error ? error.message : String(error),
            });
            this.rendererGateway.fireAndForget('chat/stream', {
                sessionId,
                messageId,
                event: 'error',
                error: error instanceof Error ? error.message : String(error),
            });
        });

        return { messageId };
    }

    private async runStream(
        sessionId: string,
        messageId: string,
        messages: CoreMessage[]
    ): Promise<void> {
        const model = this.aiProviderService.getModel();
        if (!model) {
            return;
        }
        const result = streamText({
            model,
            messages,
        });
        for await (const chunk of result.textStream) {
            this.rendererGateway.fireAndForget('chat/stream', {
                sessionId,
                messageId,
                event: 'chunk',
                chunk,
            });
        }
        this.rendererGateway.fireAndForget('chat/stream', {
            sessionId,
            messageId,
            event: 'done',
        });
    }

    private createMessageId(): string {
        return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }


    private async runAnalysisStream(sessionId: string, messageId: string, prompt: string): Promise<void> {
        const model = this.aiProviderService.getModel();
        if (!model) {
            return;
        }
        const result = streamObject({
            model,
            schema: AiUnifiedAnalysisSchema,
            prompt,
        });
        for await (const partial of result.partialObjectStream) {
            this.rendererGateway.fireAndForget('chat/analysis/stream', {
                sessionId,
                messageId,
                event: 'chunk',
                partial: this.normalizeAnalysisPartial(partial),
            });
        }
        const finalObject = await result.object;
        this.rendererGateway.fireAndForget('chat/analysis/stream', {
            sessionId,
            messageId,
            event: 'chunk',
            partial: finalObject,
        });
        this.rendererGateway.fireAndForget('chat/analysis/stream', {
            sessionId,
            messageId,
            event: 'done',
        });
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
