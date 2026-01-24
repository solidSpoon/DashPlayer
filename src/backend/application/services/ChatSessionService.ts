import { CoreMessage } from 'ai';
import { ChatStartResult, ChatWelcomeParams } from '@/common/types/chat';

export default interface ChatSessionService {
    start(sessionId: string, messages: CoreMessage[]): Promise<ChatStartResult>;
    startWelcome(params: ChatWelcomeParams): Promise<ChatStartResult>;
    reset(sessionId: string): void;
}
