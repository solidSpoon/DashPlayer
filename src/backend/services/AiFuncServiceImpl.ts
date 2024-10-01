import { ZodObject } from 'zod';
import RateLimiter from '@/common/utils/RateLimiter';
import { inject, injectable } from 'inversify';
import DpTaskService from '@/backend/services/DpTaskService';
import TYPES from '@/backend/ioc/types';
import AiFuncService from '@/backend/services/AiFuncService';
import AiProviderService from '@/backend/services/AiProviderService';


@injectable()
export default class AiFuncServiceImpl implements AiFuncService {
    @inject(TYPES.DpTaskService)
    private dpTaskService!: DpTaskService;

    @inject(TYPES.AiProviderService)
    private aiProviderService!: AiProviderService;

    public async run(taskId: number, resultSchema: ZodObject<any>, promptStr: string) {
        await RateLimiter.wait('gpt');
        // Instantiate the parser
        const chat = this.aiProviderService.getOpenAi();
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
                progress: 'AI responseing',
                result: JSON.stringify(chunk)
            });
        }
        this.dpTaskService.finish(taskId, {
            progress: 'AI has responded',
        });
    }
}
