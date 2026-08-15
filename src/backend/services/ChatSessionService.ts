import { ModelMessage } from 'ai';
import { ChatBackgroundContext, ChatStartResult, ChatWelcomeParams } from '@/common/types/chat';
import { AnalysisStartParams, AnalysisStartResult } from '@/common/types/analysis';

export default interface ChatSessionService {
    start(sessionId: string, messages: ModelMessage[], background?: ChatBackgroundContext): Promise<ChatStartResult>;
    startWelcome(params: ChatWelcomeParams): Promise<ChatStartResult>;
    startAnalysis(params: AnalysisStartParams): Promise<AnalysisStartResult>;
}
