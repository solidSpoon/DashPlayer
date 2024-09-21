import { ZodObject } from 'zod';
import { ChatOpenAI } from '@langchain/openai';
import { DpTaskState } from '@/backend/db/tables/dpTask';
import { joinUrl } from '@/common/utils/Util';
import { storeGet } from '@/backend/store';
import RateLimiter from '@/common/utils/RateLimiter';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { JsonOutputFunctionsParser } from 'langchain/output_parsers';
import { zodToJsonSchema } from 'zod-to-json-schema';
import StrUtil from '@/common/utils/str-util';
import { inject, injectable } from 'inversify';
import DpTaskService from '@/backend/services/DpTaskService';
import TYPES from '@/backend/ioc/types';
import AiFuncService from '@/backend/services/AiFuncService';


@injectable()
export default class AiFuncServiceImpl implements AiFuncService {
    @inject(TYPES.DpTaskService)
    private dpTaskService: DpTaskService;

    private async validKey(taskId: number, apiKey: string, endpoint: string) {
        if (StrUtil.isBlank(apiKey) || StrUtil.isBlank(endpoint)) {
            this.dpTaskService.fail(taskId, {
                progress: 'OpenAI api key or endpoint is empty'
            });
            return false;
        }
        return true;
    }

    public async getOpenAi(taskId: number): Promise<ChatOpenAI | null> {
        const apiKey = storeGet('apiKeys.openAi.key');
        const endpoint = storeGet('apiKeys.openAi.endpoint');
        if (!await this.validKey(taskId, apiKey, endpoint)) return null;
        let model = storeGet('model.gpt.default');
        if (StrUtil.isBlank(model)) {
            model = 'gpt-4o-mini';
        }
        console.log(apiKey, endpoint);
        return new ChatOpenAI({
            modelName: model,
            temperature: 0.7,
            openAIApiKey: apiKey,
            configuration: {
                baseURL: joinUrl(endpoint, '/v1')
            }
        });
    }

    public async run(taskId: number, resultSchema: ZodObject<any>, promptStr: string) {
        await RateLimiter.wait('gpt');
        const extractionFunctionSchema = {
            name: 'extractor',
            description: 'Extracts fields from the input.',
            parameters: zodToJsonSchema(resultSchema)
        };
        // Instantiate the parser
        const parser = new JsonOutputFunctionsParser();
        const chat: ChatOpenAI = (await this.getOpenAi(taskId));
        if (!chat) return;
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
