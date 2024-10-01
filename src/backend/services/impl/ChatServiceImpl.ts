import RateLimiter from '@/common/utils/RateLimiter';
import { BaseMessage } from '@langchain/core/messages';
import { inject, injectable } from 'inversify';
import DpTaskService from '@/backend/services/DpTaskService';
import TYPES from '@/backend/ioc/types';
import ChatService from '@/backend/services/ChatService';
import { ChatOpenAI } from '@langchain/openai';
import ClientProviderService from '@/backend/services/ClientProviderService';
import { ZodObject } from 'zod';


@injectable()
export default class ChatServiceImpl implements ChatService {

    @inject(TYPES.DpTaskService)
    private dpTaskService!: DpTaskService;

    @inject(TYPES.OpenAiClientProvider)
    private aiProviderService!: ClientProviderService<ChatOpenAI>;


    public async chat(taskId: number, msgs: BaseMessage[]) {
        await RateLimiter.wait('gpt');
        const chat = this.aiProviderService.getClient();
        if (chat) {
            this.dpTaskService.fail(taskId, {
                progress: 'OpenAI api key or endpoint is empty'
            });
        }
        this.dpTaskService.process(taskId, {
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
            this.dpTaskService.process(taskId, {
                progress: `AI typing, ${res.length} characters`,
                result: res
            });
        }
        this.dpTaskService.finish(taskId, {
            progress: 'AI has responded',
            result: res
        });
    }

    public async run(taskId: number, resultSchema: ZodObject<any>, promptStr: string) {
        await RateLimiter.wait('gpt');
        const chat = this.aiProviderService.getClient();
        if (!chat) {
            this.dpTaskService.fail(taskId, {
                progress: 'OpenAI api key or endpoint is empty'
            });
            return;
        }
        const structuredLlm = chat.withStructuredOutput(resultSchema);

        this.dpTaskService.process(taskId, {
            progress: 'AI is analyzing...'
        });

        const resStream = await structuredLlm.stream(promptStr);
        for await (const chunk of resStream) {
            this.dpTaskService.process(taskId, {
                progress: 'AI responding',
                result: JSON.stringify(chunk)
            });
        }
        this.dpTaskService.finish(taskId, {
            progress: 'AI has responded',
        });
    }
}

