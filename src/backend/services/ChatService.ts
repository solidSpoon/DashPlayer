import { BaseMessage } from '@langchain/core/messages';

export default interface ChatService {
    chat(taskId: number, msgs: BaseMessage[]): Promise<void>;
}


