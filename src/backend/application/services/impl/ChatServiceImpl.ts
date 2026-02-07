import { inject, injectable } from 'inversify';
import DpTaskService from '@/backend/application/services/DpTaskService';
import TYPES from '@/backend/ioc/types';
import ChatService from '@/backend/application/services/ChatService';
import { ZodObject } from 'zod';
import { ModelMessage, Output, streamText } from 'ai';
import AiProviderService from '@/backend/application/services/AiProviderService';
import { AiStringResponse } from '@/common/types/aiRes/AiStringResponse';
import { WithRateLimit } from '@/backend/application/kernel/concurrency/decorators';
import { getMainLogger } from '@/backend/infrastructure/logger';
@injectable()
export default class ChatServiceImpl implements ChatService {

    @inject(TYPES.DpTaskService)
    private dpTaskService!: DpTaskService;

    @inject(TYPES.AiProviderService)
    private aiProviderService!: AiProviderService;

    private logger = getMainLogger('ChatService');

    @WithRateLimit('gpt')
    public async chat(taskId: number, msgs: ModelMessage[]) {
        const model = this.aiProviderService.getModel('sentenceLearning');
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
        const response: AiStringResponse = {
            str: ''
        };
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

    @WithRateLimit('gpt')
    public async run(taskId: number, resultSchema: ZodObject<any>, promptStr: string) {
        const model = this.aiProviderService.getModel('sentenceLearning');
        if (!model) {
            this.dpTaskService.fail(taskId, {
                progress: 'OpenAI api key or endpoint is empty'
            });
            return;
        }
        this.logger.debug('stream json start', { taskId });
        const { partialOutputStream } = streamText({
            model,
            output: Output.object({ schema: resultSchema }),
            prompt: promptStr,
        });
        this.dpTaskService.process(taskId, {
            progress: 'AI is analyzing...'
        });
        for await (const partialObject of partialOutputStream) {
            this.logger.debug('stream json chunk', {
                taskId,
                keys: Object.keys(partialObject ?? {}),
            });
            this.dpTaskService.process(taskId, {
                progress: 'AI is analyzing...',
                result: JSON.stringify(partialObject)
            });
        }
        this.logger.debug('stream json done', { taskId });
        this.dpTaskService.finish(taskId, {
            progress: 'AI has responded'
        });
    }
}
