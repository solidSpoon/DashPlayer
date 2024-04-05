import { ChatOpenAI } from '@langchain/openai';
import { storeGet } from '@/backend/store';
import { HumanMessage, SystemMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { joinUrl, strBlank } from '@/common/utils/Util';
import DpTaskService from '@/backend/services/DpTaskService';
import { DpTaskState } from '@/backend/db/tables/dpTask';


export default class ChatService {

    public static async chat(taskId: number, msgs: BaseMessage[]) {
        const apiKey = storeGet('apiKeys.openAi.key');
        const endpoint = storeGet('apiKeys.openAi.endpoint');
        if (strBlank(apiKey) || strBlank(endpoint)) {
            await DpTaskService.update({
                id: taskId,
                status: DpTaskState.FAILED,
                progress: 'OpenAI api key or endpoint is empty'
            });
            return;
        }
        console.log(apiKey, endpoint);
        const chat = new ChatOpenAI({
            modelName: 'gpt-3.5-turbo',
            temperature: 0.7,
            openAIApiKey: apiKey,
            configuration: {
                baseURL: joinUrl(endpoint, '/v1')
            }
        });

        const resStream = await chat.stream(msgs);
        const chunks = [];
        let res = '';
        await DpTaskService.update({
            id: taskId,
            status: DpTaskState.IN_PROGRESS,
            progress: 'Asking AI for help'
        });
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
