import { inject, injectable } from 'inversify';
import { CoreMessage, streamObject, streamText } from 'ai';
import { getMainLogger } from '@/backend/infrastructure/logger';
import RendererGateway from '@/backend/application/ports/gateways/renderer/RendererGateway';
import TYPES from '@/backend/ioc/types';
import AiProviderService from '@/backend/application/services/AiProviderService';
import ChatSessionService from '@/backend/application/services/ChatSessionService';
import { ChatStartResult, ChatWelcomeParams, ChatWelcomeResult } from '@/common/types/chat';
import { WaitRateLimit } from '@/common/utils/RateLimiter';
import { AiFuncTranslateWithContextPrompt } from '@/common/types/aiRes/AiFuncTranslateWithContextRes';
import { AiFuncPolishPrompt } from '@/common/types/aiRes/AiFuncPolish';
import { z } from 'zod';

type ChatSession = {
    messages: CoreMessage[];
};

@injectable()
export default class ChatSessionServiceImpl implements ChatSessionService {
    private logger = getMainLogger('ChatSessionService');
    private sessions = new Map<string, ChatSession>();

    @inject(TYPES.AiProviderService)
    private aiProviderService!: AiProviderService;

    @inject(TYPES.RendererGateway)
    private rendererGateway!: RendererGateway;

    public reset(sessionId: string): void {
        this.sessions.delete(sessionId);
    }

    public async buildWelcome(params: ChatWelcomeParams): Promise<ChatWelcomeResult> {
        const lines: string[] = [];
        lines.push('## 句子分析报告', '');
        lines.push('**原始句子**', '');
        lines.push(this.wrapTts(params.originalTopic));
        const context = params.fullText ? [params.fullText] : [];
        const translate = await this.runObject(AiFuncTranslateWithContextPrompt.schema,
            AiFuncTranslateWithContextPrompt.promptFunc(params.originalTopic, context));
        if (translate?.translation) {
            lines.push('', `> ${translate.translation}`);
        }
        lines.push('', '已经为您生成了这个句子的知识点, 包括生词, 短语, 语法, 例句等.');

        const punctuationSchema = z.object({
            isComplete: z.boolean().describe('句子是否完整'),
            completeVersion: z.string().describe('完整的句子'),
        });
        const fullText = params.fullText ?? '';
        const punctuation = this.isNotBlank(fullText)
            ? await this.runObject(punctuationSchema, this.buildPunctuationPrompt(params.originalTopic, fullText))
            : null;
        const completeVersion = punctuation?.completeVersion ?? '';
        const shouldSuggestSwitch = (punctuation?.isComplete === false) &&
            this.isNotBlank(completeVersion) &&
            this.normalizeText(completeVersion) !== this.normalizeText(params.originalTopic);
        if (shouldSuggestSwitch) {
            lines.push(
                '',
                '### 建议更换会话内容',
                '这句话可能被换行打断了, 完整形式如下:',
                '',
                this.wrapTts(completeVersion),
                '',
                this.wrapSwitch(completeVersion, '点击切换')
            );
        }

        const polish = await this.runObject(AiFuncPolishPrompt.schema, AiFuncPolishPrompt.promptFunc(params.originalTopic));
        const polishEdits = [polish?.edit1, polish?.edit2, polish?.edit3]
            .filter((value) => this.isNotBlank(value)) as string[];
        if (polishEdits.length > 0) {
            lines.push('', '### 同义句', '这个句子还有如下几种表达方式:', '');
            polishEdits.forEach((edit) => {
                lines.push(`- ${this.wrapTts(edit)}`);
            });
        }

        const display = lines.join('\n');
        return {
            display,
            context: this.stripSwitchMarkers(display),
        };
    }

    @WaitRateLimit('gpt')
    public async start(sessionId: string, messages: CoreMessage[]): Promise<ChatStartResult> {
        const messageId = this.createMessageId();
        this.ensureSession(sessionId, messages);
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

        this.runStream(sessionId, messageId, messages).catch((error) => {
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

    private ensureSession(sessionId: string, messages: CoreMessage[]): void {
        this.sessions.set(sessionId, { messages });
    }

    private async runStream(sessionId: string, messageId: string, messages: CoreMessage[]): Promise<void> {
        const model = this.aiProviderService.getModel();
        if (!model) {
            return;
        }
        const result = streamText({
            model,
            messages,
        });
        let response = '';
        for await (const chunk of result.textStream) {
            response += chunk;
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
        const session = this.sessions.get(sessionId);
        if (session) {
            session.messages = [...messages, { role: 'assistant', content: response }];
        }
    }

    private createMessageId(): string {
        return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }

    private wrapTts(text: string): string {
        return `[[tts:${text}]]`;
    }

    private wrapSwitch(text: string, label: string): string {
        const encoded = encodeURIComponent(text);
        return `[[switch:${encoded}|${label}]]`;
    }

    private stripSwitchMarkers(content: string): string {
        return content.replace(/\[\[switch:[\s\S]*?\]\]/g, '');
    }

    private isNotBlank(value?: string | null): boolean {
        return !!value && value.trim().length > 0;
    }

    private normalizeText(value: string | null | undefined): string {
        return (value ?? '').trim().replace(/\s+/g, ' ');
    }

    private buildPunctuationPrompt(sentence: string, fullText: string): string {
        return [
            '给定一个可能被换行打断的英文句子，以及包含它的完整段落，判断该句子是否完整。',
            '如果不完整，请输出完整句子。',
            '',
            '完整段落:',
            fullText,
            '',
            '待判断句子:',
            sentence,
        ].join('\n');
    }

    private async runObject<T>(schema: z.ZodTypeAny, prompt: string): Promise<T | null> {
        const model = this.aiProviderService.getModel();
        if (!model) {
            return null;
        }
        try {
            const { partialObjectStream } = streamObject({
                model,
                schema,
                prompt,
            });
            let result: Record<string, unknown> = {};
            for await (const partial of partialObjectStream) {
                if (partial && typeof partial === 'object') {
                    result = { ...result, ...partial };
                }
            }
            return result as T;
        } catch (error) {
            this.logger.error('welcome ai request failed', {
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }
}
