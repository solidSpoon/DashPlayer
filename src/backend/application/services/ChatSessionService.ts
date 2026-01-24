import { CoreMessage } from 'ai';
import { ChatStartResult, ChatWelcomeParams } from '@/common/types/chat';
import { AnalysisStartParams, AnalysisStartResult } from '@/common/types/analysis';

export default interface ChatSessionService {
    start(sessionId: string, messages: CoreMessage[]): Promise<ChatStartResult>;
    startWelcome(params: ChatWelcomeParams): Promise<ChatStartResult>;
    startAnalysis(params: AnalysisStartParams): Promise<AnalysisStartResult>;
    reset(sessionId: string): void;
}
