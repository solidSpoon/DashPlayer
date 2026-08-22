import { inject, injectable } from 'inversify';
import registerRoute from '@/backend/controllers/ipc/registerRoute';
import Controller from '@/backend/controllers/Controller';
import TYPES from '@/backend/ioc/types';
import ChatSessionService from '@/backend/services/ChatSessionService';
import {
    ChatSessionCloseParams,
    ChatSessionCreateParams,
    ChatSessionCreateResult,
    ChatStartParams,
    ChatStartResult,
    ChatWelcomeParams,
} from '@/common/types/chat';
import { AnalysisStartParams, AnalysisStartResult } from '@/common/types/analysis';

@injectable()
export default class ChatStreamController implements Controller {
    @inject(TYPES.ChatSessionService)
    private chatSessionService!: ChatSessionService;

    registerRoutes(): void {
        registerRoute('chat/session/create', async (
            params: ChatSessionCreateParams,
        ): Promise<ChatSessionCreateResult> => {
            return this.chatSessionService.create(params);
        });

        registerRoute('chat/session/close', async (params: ChatSessionCloseParams): Promise<void> => {
            this.chatSessionService.close(params.sessionId);
        });

        registerRoute('chat/session/stop', async (params: ChatSessionCloseParams): Promise<void> => {
            this.chatSessionService.stop(params.sessionId);
        });

        registerRoute('chat/start', async (params: ChatStartParams): Promise<ChatStartResult> => {
            return this.chatSessionService.start(params.sessionId, params.content, params.reasoningEffort);
        });

        registerRoute('chat/welcome', async (params: ChatWelcomeParams): Promise<ChatStartResult> => {
            return this.chatSessionService.startWelcome(params);
        });

        registerRoute('chat/analysis/start', async (params: AnalysisStartParams): Promise<AnalysisStartResult> => {
            return this.chatSessionService.startAnalysis(params);
        });

    }
}
