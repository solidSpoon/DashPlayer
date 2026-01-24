import { inject, injectable } from 'inversify';
import { CoreMessage, streamText } from 'ai';
import { getMainLogger } from '@/backend/infrastructure/logger';
import RendererGateway from '@/backend/application/ports/gateways/renderer/RendererGateway';
import TYPES from '@/backend/ioc/types';
import AiProviderService from '@/backend/application/services/AiProviderService';
import ChatSessionService from '@/backend/application/services/ChatSessionService';
import { ChatStartResult } from '@/common/types/chat';
import { WaitRateLimit } from '@/common/utils/RateLimiter';

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
}
