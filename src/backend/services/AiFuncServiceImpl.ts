import { ZodObject } from 'zod';
import RateLimiter from '@/common/utils/RateLimiter';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { JsonOutputFunctionsParser } from 'langchain/output_parsers';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { inject, injectable } from 'inversify';
import DpTaskService from '@/backend/services/DpTaskService';
import TYPES from '@/backend/ioc/types';
import AiFuncService from '@/backend/services/AiFuncService';
import AiProviderService from '@/backend/services/AiProviderService';


@injectable()
export default class AiFuncServiceImpl implements AiFuncService {
    @inject(TYPES.DpTaskService)
    private dpTaskService: DpTaskService;

    @inject(TYPES.AiProviderService)
    private aiProviderService: AiProviderService;

    public async run(taskId: number, resultSchema: ZodObject<any>, promptStr: string) {
        await RateLimiter.wait('gpt');
        const extractionFunctionSchema = {
            name: 'extractor',
            description: 'Extracts fields from the input.',
            parameters: zodToJsonSchema(resultSchema)
        };
        // Instantiate the parser
        const parser = new JsonOutputFunctionsParser();
        const chat = this.aiProviderService.getOpenAi();
        if (!chat) {
            this.dpTaskService.fail(taskId, {
                progress: 'OpenAI api key or endpoint is empty'
            });
        }
        const runnable = chat.bind({
            functions: [extractionFunctionSchema],
            function_call: { name: 'extractor' }
        });
        const prompt: ChatPromptTemplate = ChatPromptTemplate.fromTemplate(promptStr);

        // todo: fix the type
        const chain = prompt
            .pipe(runnable as any)
            .pipe(parser);
        this.dpTaskService.process(taskId, {
            progress: 'AI is analyzing...'
        });

        const resStream = await chain.stream({});
        for await (const chunk of resStream) {
            this.dpTaskService.process(taskId, {
                progress: 'AI responseing',
                result: JSON.stringify(chunk)
            });
        }
        this.dpTaskService.finish(taskId, {
            progress: 'AI has responded'
        });
    }
}
