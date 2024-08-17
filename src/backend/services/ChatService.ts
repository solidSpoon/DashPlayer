
import DpTaskService from '@/backend/services/DpTaskService';
import {DpTaskState} from '@/backend/db/tables/dpTask';
import AiFunc from "@/backend/services/AiFuncs/ai-func";
import RateLimiter from "@/common/utils/RateLimiter";
import { BaseMessage } from '@langchain/core/messages';
export default class ChatService {



    public static async chat(taskId: number, msgs: BaseMessage[]) {
        await RateLimiter.wait('gpt')
        const chat = await AiFunc.getOpenAi(taskId);
        if (!chat) return;
        DpTaskService.update({
            id: taskId,
            status: DpTaskState.IN_PROGRESS,
            progress: 'AI is thinking...'
        });
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const resStream = await chat.stream(msgs);
        const chunks = [];
        let res = '';
        for await (const chunk of resStream) {
            res += chunk.content;
            chunks.push(chunk);
            DpTaskService.update({
                id: taskId,
                status: DpTaskState.IN_PROGRESS,
                progress: `AI typing, ${res.length} characters`,
                result: res
            });
        }
        DpTaskService.update({
            id: taskId,
            status: DpTaskState.DONE,
            progress: 'AI has responded',
            result: res
        });
    }
}

