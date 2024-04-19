
import {BaseMessage} from '@langchain/core/messages';
import DpTaskService from '@/backend/services/DpTaskService';
import {DpTaskState} from '@/backend/db/tables/dpTask';
import AiFunc from "@/backend/services/AiFuncs/ai-func";
import RateLimiter from "@/common/utils/RateLimiter";
export default class ChatService {



    public static async chat(taskId: number, msgs: BaseMessage[]) {
        await RateLimiter.wait('gpt')
        const chat = await AiFunc.getOpenAi(taskId);
        if (!chat) return;
        await DpTaskService.update({
            id: taskId,
            status: DpTaskState.IN_PROGRESS,
            progress: 'AI is thinking...'
        });
        const resStream = await chat.stream(msgs);
        const chunks = [];
        let res = '';
        for await (const chunk of resStream) {
            res += chunk.content;
            chunks.push(chunk);
            await DpTaskService.update({
                id: taskId,
                status: DpTaskState.IN_PROGRESS,
                progress: `AI typing, ${res.length} characters`,
                result: res
            });
        }
        await DpTaskService.update({
            id: taskId,
            status: DpTaskState.DONE,
            progress: 'AI has responded',
            result: res
        });
    }
}

