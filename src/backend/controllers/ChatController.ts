import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import ChatService from '@/backend/services/ChatService';
import { n } from 'vitest/dist/reporters-P7C2ytIv';
import { DpTaskState } from '@/backend/db/tables/dpTask';
import DpTaskService from '@/backend/services/DpTaskService';
import { AnalyzeSentenceParams } from '@/common/types/AnalyzeSentenceParams';

export default class ChatController {
    public static async chat(msgs: BaseMessage[]): Promise<number> {
        let taskId = await DpTaskService.create();
        ChatService.chat(taskId, msgs).then();
        return taskId;
    }
    public static async analyzeSentence(params: AnalyzeSentenceParams) {
        let taskId = await DpTaskService.create();
        ChatService.analyzeSentence(taskId, params).then();
        return taskId;
    }
}
