import {z, ZodObject} from "zod";
import {zodToJsonSchema} from "zod-to-json-schema";
import {JsonOutputFunctionsParser} from "langchain/output_parsers";
import {ChatOpenAI} from "@langchain/openai";
import {ChatPromptTemplate} from "@langchain/core/prompts";
import DpTaskService from "@/backend/services/DpTaskService";
import {DpTaskState} from "@/backend/db/tables/dpTask";
import {joinUrl, strBlank} from "@/common/utils/Util";
import {storeGet} from "@/backend/store";
import RateLimiter from "@/common/utils/RateLimiter";

export default class AiFunc {
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

    public static async run(taskId: number, resultSchema: ZodObject<any>, promptStr: string) {
        await RateLimiter.wait('gpt');
        const extractionFunctionSchema = {
            name: "extractor",
            description: "Extracts fields from the input.",
            parameters: zodToJsonSchema(resultSchema),
        };
        // Instantiate the parser
        const parser = new JsonOutputFunctionsParser();
        const chat: ChatOpenAI = (await this.getOpenAi(taskId))
        if (!chat) return;
        const runnable = chat.bind({
            functions: [extractionFunctionSchema],
            function_call: {name: "extractor"},
        })
        const prompt: ChatPromptTemplate = ChatPromptTemplate.fromTemplate(promptStr);
        const chain = prompt
            .pipe(runnable)
            .pipe(parser);
        await DpTaskService.update({
            id: taskId,
            status: DpTaskState.IN_PROGRESS,
            progress: 'AI is analyzing...'
        });

        const resStream = await chain.stream({});
        for await (const chunk of resStream) {
            await DpTaskService.update({
                id: taskId,
                status: DpTaskState.IN_PROGRESS,
                progress: 'AI responseing',
                result: JSON.stringify(chunk)
            });
        }
        await DpTaskService.update({
            id: taskId,
            status: DpTaskState.DONE,
            progress: 'AI has responded',
        });
    }
}
