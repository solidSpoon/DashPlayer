import { ChatOpenAI } from '@langchain/openai';
import { storeGet } from '@/backend/store';
import { BaseMessage } from '@langchain/core/messages';
import { joinUrl, strBlank } from '@/common/utils/Util';
import DpTaskService from '@/backend/services/DpTaskService';
import { DpTaskState } from '@/backend/db/tables/dpTask';
import {
    ChatPromptTemplate,
    MessagesPlaceholder
} from '@langchain/core/prompts';
import { AnalyzeSentenceParams } from '@/common/types/AnalyzeSentenceParams';
import RateLimiter from '@/backend/services/RateLimiter';

export default class ChatService {
    private static rateLimiter = new RateLimiter();

    private static async validKey(taskId: number, apiKey: string, endpoint: string) {
        if (strBlank(apiKey) || strBlank(endpoint)) {
            await DpTaskService.update({
                id: taskId,
                status: DpTaskState.FAILED,
                progress: 'OpenAI api key or endpoint is empty'
            });
            return false;
        }
        return true;
    }

    public static async getOpenAi(taskId: number): Promise<ChatOpenAI | null> {
        const apiKey = storeGet('apiKeys.openAi.key');
        const endpoint = storeGet('apiKeys.openAi.endpoint');
        if (!await this.validKey(taskId, apiKey, endpoint)) return null;
        console.log(apiKey, endpoint);
        return new ChatOpenAI({
            modelName: 'gpt-3.5-turbo',
            temperature: 0.7,
            openAIApiKey: apiKey,
            configuration: {
                baseURL: joinUrl(endpoint, '/v1')
            }
        });
    }

    public static async chat(taskId: number, msgs: BaseMessage[]) {
        if (!await this.rateLimiter.limitRate(taskId)) return;
        const chat = await this.getOpenAi(taskId);
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


    public static async analyzeSentence(taskId: number, { sentence, context }: AnalyzeSentenceParams) {
        if (!await this.rateLimiter.limitRate(taskId)) return;
        const chat = await this.getOpenAi(taskId);
        if (!chat) return;
        const prompt = ChatPromptTemplate.fromTemplate(
            `你现在是一个播放器软件中的，英语学习程序，你的任务是帮助具有中等英文水平且母语是中文的人理解英语字幕，字幕中的生词、涉及到的语法。由于字幕可能在句子中间换行，为了帮助你分析，我会把当前行的上下文也一同发给你，你需要依次做下面几件事情。

- 根据上下文润色当前行
- 翻译这个句子
- 标记生词和短语
- 分析语法

由于你是一个程序，所以当被要求分析句子时，必须严格按照以下md格式返回：

<格式示例>
## 英文：
!todo
## 翻译：
!todo
## 生词｜短语：
!toto in list
## 语法：
!todo
</格式示例>

下面，请分析下面内容
<请分析>
<上下文>
{ctx}
</上下文>
<当前行>
{s}
</当前行>
</请分析>`
        );
        const chain = prompt.pipe(chat);
        console.log(await prompt.format({
            s: sentence,
            ctx: context.join('\n')
        }));
        await DpTaskService.update({
            id: taskId,
            status: DpTaskState.IN_PROGRESS,
            progress: 'AI is analyzing...'
        });

        const resStream = await chain.stream({
            s: sentence,
            ctx: context.join('\n')
        });
        const chunks = [];
        let res = '';
        for await (const chunk of resStream) {
            res += chunk.content;
            chunks.push(chunk);
            await DpTaskService.update({
                id: taskId,
                status: DpTaskState.IN_PROGRESS,
                progress: `AI analyzing, ${res.length} characters`,
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
