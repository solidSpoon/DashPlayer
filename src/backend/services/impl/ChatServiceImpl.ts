import RateLimiter from '@/common/utils/RateLimiter';
import { inject, injectable } from 'inversify';
import DpTaskService from '@/backend/services/DpTaskService';
import TYPES from '@/backend/ioc/types';
import ChatService from '@/backend/services/ChatService';
import { ZodObject } from 'zod';
import { CoreMessage, streamObject, streamText } from 'ai';
import AiProviderService from '@/backend/services/AiProviderService';
import {AiStringResponse} from "@/common/types/aiRes/AiStringResponse";
@injectable()
export default class ChatServiceImpl implements ChatService {

    @inject(TYPES.DpTaskService)
    private dpTaskService!: DpTaskService;

    @inject(TYPES.AiProviderService)
    private aiProviderService!: AiProviderService;


    public async chat(taskId: number, msgs: CoreMessage[]) {
        await RateLimiter.wait('gpt');
        const model = this.aiProviderService.getModel();
        if (!model) {
            this.dpTaskService.fail(taskId, {
                progress: 'OpenAI api key or endpoint is empty'
            });
            return;
        }
        this.dpTaskService.process(taskId, {
            progress: 'AI is thinking...'
        });

        const result = streamText({
            model: model,
            messages: msgs
        });
        const response : AiStringResponse = {
            str: ''
        }
        for await (const chunk of result.textStream) {
            response.str += chunk;
            this.dpTaskService.process(taskId, {
                progress: `AI typing, ${response.str.length} characters`,
                result: JSON.stringify(response)
            });
        }

        this.dpTaskService.finish(taskId, {
            progress: 'AI has responded',
            result: JSON.stringify(response)
        });
    }

    public async run(taskId: number, resultSchema: ZodObject<any>, promptStr: string) {
        await RateLimiter.wait('gpt');
        const model = this.aiProviderService.getModel();
        if (!model) {
            this.dpTaskService.fail(taskId, {
                progress: 'OpenAI api key or endpoint is empty'
            });
            return;
        }
        const { partialObjectStream } = streamObject({
            model: model,
            schema: resultSchema,
            prompt: promptStr,
        });
        this.dpTaskService.process(taskId, {
            progress: 'AI is analyzing...'
        });
        for await (const partialObject of partialObjectStream) {
            this.dpTaskService.process(taskId, {
                progress: 'AI is analyzing...',
                result: JSON.stringify(partialObject)
            });
        }
        this.dpTaskService.finish(taskId, {
            progress: 'AI has responded'
        });
    }
}

