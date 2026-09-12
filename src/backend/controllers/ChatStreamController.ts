import { inject, injectable } from 'inversify';
import registerRoute from '@/backend/controllers/ipc/registerRoute';
import Controller from '@/backend/controllers/Controller';
import TYPES from '@/backend/ioc/types';
import ChatSessionService from '@/backend/services/ChatSessionService';
import {
    ChatSessionCloseParams,
    ChatSessionCreateParams,
    ChatSessionCreateResult,
    ChatSessionStopParams,
    ChatSendMessageParams,
    ChatSendMessageResult,
    CompleteSentenceParams,
    CompleteSentenceResult,
} from '@/common/types/chat';
import { AnalysisStartParams, AnalysisStartResult } from '@/common/types/analysis';
import SentenceLearningService from '@/backend/services/SentenceLearningService';

@injectable()
export default class ChatStreamController implements Controller {
    @inject(TYPES.ChatSessionService)
    private chatSessionService!: ChatSessionService;

    @inject(TYPES.SentenceLearningService)
    private sentenceLearningService!: SentenceLearningService;

    registerRoutes(): void {
        registerRoute('chat/session/create', async (
            params: ChatSessionCreateParams,
        ): Promise<ChatSessionCreateResult> => {
            return this.chatSessionService.create(params);
        });

        registerRoute('chat/session/close', async (params: ChatSessionCloseParams): Promise<void> => {
            this.chatSessionService.close(params.sessionId);
        });

        registerRoute('chat/session/stop', async (params: ChatSessionStopParams): Promise<void> => {
            this.chatSessionService.stop(params.sessionId);
        });

        registerRoute('chat/send-message', async (params: ChatSendMessageParams): Promise<ChatSendMessageResult> => {
            return this.chatSessionService.sendMessage(params);
        });

        registerRoute('chat/analysis/start', async (params: AnalysisStartParams): Promise<AnalysisStartResult> => {
            return this.chatSessionService.startAnalysis(params);
        });

        registerRoute('chat/complete-sentence', async (
            params: CompleteSentenceParams,
        ): Promise<CompleteSentenceResult> => {
            return this.sentenceLearningService.completeSentence(params);
        });

        registerRoute('chat/learning/available', async (): Promise<boolean> => {
            return this.sentenceLearningService.isLearningAvailable();
        });

    }
}
