import { CoreMessage } from 'ai';
import { ChatStartResult, ChatWelcomeParams, ChatWelcomeResult } from '@/common/types/chat';

export default interface ChatSessionService {
    start(sessionId: string, messages: CoreMessage[]): Promise<ChatStartResult>;
    buildWelcome(params: ChatWelcomeParams): Promise<ChatWelcomeResult>;
    reset(sessionId: string): void;
}
