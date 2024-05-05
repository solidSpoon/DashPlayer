import {BaseMessage} from '@langchain/core/messages';
import ChatService from '@/backend/services/ChatService';
import DpTaskService from '@/backend/services/DpTaskService';

export default class ChatController {
    public static async chat(msgs: BaseMessage[]): Promise<number> {
        const taskId = await DpTaskService.create();
        ChatService.chat(taskId, msgs).then();
        return taskId;
    }
}
