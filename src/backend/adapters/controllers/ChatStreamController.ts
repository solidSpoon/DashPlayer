import { inject, injectable } from 'inversify';
import registerRoute from '@/backend/adapters/ipc/registerRoute';
import Controller from '@/backend/adapters/controllers/Controller';
import TYPES from '@/backend/ioc/types';
import ChatSessionService from '@/backend/application/services/ChatSessionService';
import { ChatResetParams, ChatStartParams, ChatStartResult, ChatWelcomeParams, ChatWelcomeResult } from '@/common/types/chat';

@injectable()
export default class ChatStreamController implements Controller {
    @inject(TYPES.ChatSessionService)
    private chatSessionService!: ChatSessionService;

    registerRoutes(): void {
        registerRoute('chat/start', async (params: ChatStartParams): Promise<ChatStartResult> => {
            return this.chatSessionService.start(params.sessionId, params.messages);
        });

        registerRoute('chat/welcome', async (params: ChatWelcomeParams): Promise<ChatWelcomeResult> => {
            return this.chatSessionService.buildWelcome(params);
        });

        registerRoute('chat/reset', async (params: ChatResetParams): Promise<void> => {
            this.chatSessionService.reset(params.sessionId);
        });
    }
}
