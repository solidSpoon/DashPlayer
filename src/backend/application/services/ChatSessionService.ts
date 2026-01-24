import { CoreMessage } from 'ai';
import { ChatStartResult } from '@/common/types/chat';

export default interface ChatSessionService {
    start(sessionId: string, messages: CoreMessage[]): Promise<ChatStartResult>;
    reset(sessionId: string): void;
}
