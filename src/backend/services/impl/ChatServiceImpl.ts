import { inject, injectable } from 'inversify';
import DpTaskService from '@/backend/services/DpTaskService';
import TYPES from '@/backend/ioc/types';
import ChatService from '@/backend/services/ChatService';
import { ZodObject } from 'zod';
import { CoreMessage, streamObject, streamText } from 'ai';
import AiProviderService from '@/backend/services/AiProviderService';
import {AiStringResponse} from "@/common/types/aiRes/AiStringResponse";
import { WaitRateLimit } from '@/common/utils/RateLimiter';
import dpLog from '@/backend/ioc/logger';
@injectable()
export default class ChatServiceImpl implements ChatService {

    @inject(TYPES.DpTaskService)
    private dpTaskService!: DpTaskService;

    @inject(TYPES.AiProviderService)
    private aiProviderService!: AiProviderService;

    @inject(TYPES.Logger)
    private logger!: typeof dpLog;


    @WaitRateLimit('gpt')
    public async chat(taskId: number, msgs: CoreMessage[]) {
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

    @WaitRateLimit('gpt')
    public async run(taskId: number, resultSchema: ZodObject<any>, promptStr: string) {
        this.logger.info(`Starting run for taskId: ${taskId}, prompt: ${promptStr}`);
        const model = this.aiProviderService.getModel();
        if (!model) {
            this.dpTaskService.fail(taskId, {
                progress: 'OpenAI api key or endpoint is empty'
            });
            this.logger.warn(`Run failed for taskId: ${taskId} - OpenAI API key or endpoint is empty.`);
            return;
        }

        let finalResult: any = null;
        try {
            const { partialObjectStream } = streamObject({
                model: model,
                schema: resultSchema,
                prompt: promptStr,
            });
            this.dpTaskService.process(taskId, {
                progress: 'AI is analyzing...'
            });
            for await (const partialObject of partialObjectStream) {
                this.logger.info(`Partial object for taskId: ${taskId}: ${JSON.stringify(partialObject)}`);
                this.dpTaskService.process(taskId, {
                    progress: 'AI is analyzing...',
                    result: JSON.stringify(partialObject)
                });
                finalResult = partialObject;
            }
            this.logger.info(`Finished processing partial objects for taskId: ${taskId}. Final result captured.`);
        } catch (error: any) {
            this.logger.error(`Error in run for taskId: ${taskId}: ${error.message}`, error);
            this.dpTaskService.fail(taskId, {
                progress: `Error during AI analysis: ${error.message}`
            });
            return;
        }

        this.logger.info(`Final response for taskId: ${taskId}: ${JSON.stringify(finalResult)}`);
        this.dpTaskService.finish(taskId, {
            progress: 'AI has responded',
            result: JSON.stringify(finalResult)
        });
    }
}

