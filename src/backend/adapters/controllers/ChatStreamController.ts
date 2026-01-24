import { inject, injectable } from 'inversify';
import registerRoute from '@/backend/adapters/ipc/registerRoute';
import Controller from '@/backend/adapters/controllers/Controller';
import TYPES from '@/backend/ioc/types';
import ChatSessionService from '@/backend/application/services/ChatSessionService';
import { ChatResetParams, ChatStartParams, ChatStartResult, ChatWelcomeParams } from '@/common/types/chat';
import { AnalysisStartParams, AnalysisStartResult } from '@/common/types/analysis';

@injectable()
export default class ChatStreamController implements Controller {
    @inject(TYPES.ChatSessionService)
    private chatSessionService!: ChatSessionService;

    registerRoutes(): void {
        registerRoute('chat/start', async (params: ChatStartParams): Promise<ChatStartResult> => {
            return this.chatSessionService.start(params.sessionId, params.messages);
        });

        registerRoute('chat/welcome', async (params: ChatWelcomeParams): Promise<ChatStartResult> => {
            return this.chatSessionService.startWelcome(params);
        });

        registerRoute('analysis/start', async (params: AnalysisStartParams): Promise<AnalysisStartResult> => {
            return this.chatSessionService.startAnalysis(params);
        });

        registerRoute('chat/reset', async (params: ChatResetParams): Promise<void> => {
            this.chatSessionService.reset(params.sessionId);
        });
    }
}
