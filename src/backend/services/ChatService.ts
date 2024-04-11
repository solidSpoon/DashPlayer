import {ChatOpenAI} from '@langchain/openai';
import {storeGet} from '@/backend/store';
import {BaseMessage} from '@langchain/core/messages';
import {joinUrl, strBlank} from '@/common/utils/Util';
import DpTaskService from '@/backend/services/DpTaskService';
import {DpTaskState} from '@/backend/db/tables/dpTask';
import {
    ChatPromptTemplate,
    MessagesPlaceholder
} from '@langchain/core/prompts';
import {AnalyzeSentenceParams} from '@/common/types/aiRes/AnalyzeSentenceParams';
import RateLimiter from '@/backend/services/RateLimiter';
import {mainPrompt} from "@/backend/services/prompts/prompt";
import analyzeWordsPrompt from "@/backend/services/prompts/analyze-word";
import {z} from "zod";
import {zodToJsonSchema} from "zod-to-json-schema";
import {JsonOutputFunctionsParser} from "langchain/output_parsers";
import {RunnableLike} from "@langchain/core/dist/runnables/base";
import exampleSentences from "@/backend/services/prompts/example-sentence";
import analyzeParasesPrompt from './prompts/analyze-phrases';
import summaryPrompt from './prompts/summary-prompt';
import synonymousSentence from "@/backend/services/prompts/synonymous-sentence";
import phraseGroupPrompt from "@/backend/services/prompts/phraseGroupPropmt";
import {IterableReadableStream} from "@langchain/core/dist/utils/stream";
import promptPunctuation from "@/backend/services/prompts/prompt-punctuation";
import {getSubtitleContent, srtSlice} from "@/common/utils/srtSlice";
import {describe} from "vitest";
import AiPunctuationResp from "@/common/types/aiRes/AiPunctuationResp";

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


    public static async analyzeSentence(taskId: number, {sentence, context}: AnalyzeSentenceParams) {
        if (!await this.rateLimiter.limitRate(taskId)) return;
        const chat = await this.getOpenAi(taskId);
        if (!chat) return;
        const prompt = ChatPromptTemplate.fromTemplate(mainPrompt);
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

    public static async analyzeWord(taskId: number, sentence: string) {
        if (!await this.rateLimiter.limitRate(taskId)) return;
        const schema = z.object({
            hasNewWord: z.boolean().describe("Whether the sentence contains new words for an intermediate English speaker"),
            words: z.array(
                z.object({
                    word: z.string().describe("The word"),
                    phonetic: z.string().describe("The phonetic of the word"),
                    meaning: z.string().describe("The meaning of the word in Chinese, Because it is for intermediate English speakers, who may not understand English well, so the meaning is in Chinese"),
                })
            ).describe("A list of new words for an intermediate English speaker, if none, it should be an empty list"),
        });

        const extractionFunctionSchema = {
            name: "extractor",
            description: "Extracts fields from the input.",
            parameters: zodToJsonSchema(schema),
        };
        // Instantiate the parser
        const parser = new JsonOutputFunctionsParser();
        const chat: ChatOpenAI = (await this.getOpenAi(taskId))
        if (!chat) return;
        const runnable = chat.bind({
            functions: [extractionFunctionSchema],
            function_call: {name: "extractor"},
        })
        const prompt = ChatPromptTemplate.fromTemplate(analyzeWordsPrompt);
        const chain = prompt
            .pipe(runnable)
            .pipe(parser);
        console.log(await prompt.format({
            s: sentence,
        }));
        await DpTaskService.update({
            id: taskId,
            status: DpTaskState.IN_PROGRESS,
            progress: 'AI is analyzing...'
        });

        const resStream = await chain.stream({
            s: sentence,
        });
        await ChatService.processJsonResp(taskId, resStream);
    }

    public static async analyzePhrase(taskId: number, sentence: string) {
        if (!await this.rateLimiter.limitRate(taskId)) return;
        const schema = z.object({
            hasNewPhrase: z.boolean().describe("Whether the sentence contains new phrases for an intermediate English speaker"),
            phrases: z.array(
                z.object({
                    phrase: z.string().describe("The phrase"),
                    meaning: z.string().describe("The meaning of the phrase in Chinese, Because it is for Chinese, who may not understand English well, so the meaning is in Chinese"),
                })
            ).describe("A list of new phrases for an intermediate English speaker, if none, it should be an empty list"),
        });

        const extractionFunctionSchema = {
            name: "extractor",
            description: "Extracts fields from the input.",
            parameters: zodToJsonSchema(schema),
        };
        // Instantiate the parser
        const parser = new JsonOutputFunctionsParser();
        const chat: ChatOpenAI = (await this.getOpenAi(taskId))
        if (!chat) return;
        const runnable = chat.bind({
            functions: [extractionFunctionSchema],
            function_call: {name: "extractor"},
        })
        const prompt = ChatPromptTemplate.fromTemplate(analyzeParasesPrompt);
        const chain = prompt
            .pipe(runnable)
            .pipe(parser);
        console.log(await prompt.format({
            s: sentence,
        }));
        await DpTaskService.update({
            id: taskId,
            status: DpTaskState.IN_PROGRESS,
            progress: 'AI is analyzing...'
        });

        const resStream = await chain.stream({
            s: sentence,
        });
        await ChatService.processJsonResp(taskId, resStream);
    }

    public static async analyzeGrammer(taskId: number, sentence: string) {
        if (!await this.rateLimiter.limitRate(taskId)) return;
        const schema = z.object({
            hasGrammar: z.boolean().describe("Whether the sentence contains grammar for an intermediate English speaker"),
            grammars: z.array(
                z.object({
                    description: z.string().describe("The description of the grammar"),
                })
            ).describe("A list of grammar for an intermediate English speaker, if none, it should be an empty list"),
        });

        const extractionFunctionSchema = {
            name: "extractor",
            description: "Extracts fields from the input.",
            parameters: zodToJsonSchema(schema),
        };
        // Instantiate the parser
        const parser = new JsonOutputFunctionsParser();
        const chat: ChatOpenAI = (await this.getOpenAi(taskId))
        if (!chat) return;
        const runnable = chat.bind({
            functions: [extractionFunctionSchema],
            function_call: {name: "extractor"},
        })
        const prompt = ChatPromptTemplate.fromTemplate(analyzeWordsPrompt);
        const chain = prompt
            .pipe(runnable)
            .pipe(parser);
        console.log(await prompt.format({
            s: sentence,
        }));
        await DpTaskService.update({
            id: taskId,
            status: DpTaskState.IN_PROGRESS,
            progress: 'AI is analyzing...'
        });

        const resStream = await chain.stream({
            s: sentence,
        });
        await ChatService.processJsonResp(taskId, resStream);
    }

    public static async makeSentences(taskId: number, sentence: string, point: string[]) {
        if (!await this.rateLimiter.limitRate(taskId)) return;
        const schema = z.object({
            sentences: z.array(
                z.object({
                    sentence: z.string().describe("The example sentence"),
                    meaning: z.string().describe("The meaning of the sentence in Chinese, Because it is for Chinese, who may not understand English well, so the meaning is in Chinese"),
                    points: z.array(z.string().describe("points you use in the sentence")),
                })
            ).describe("A list of example sentences for an intermediate English speaker. length should be 5"),
        });

        const extractionFunctionSchema = {
            name: "extractor",
            description: "Extracts fields from the input.",
            parameters: zodToJsonSchema(schema),
        };
        // Instantiate the parser
        const parser = new JsonOutputFunctionsParser();
        const chat: ChatOpenAI = (await this.getOpenAi(taskId))
        if (!chat) return;
        const runnable = chat.bind({
            functions: [extractionFunctionSchema],
            function_call: {name: "extractor"},
        })
        const prompt = ChatPromptTemplate.fromTemplate(exampleSentences);
        const chain = prompt
            .pipe(runnable)
            .pipe(parser);
        console.log(await prompt.format({
            s: sentence,
            p: point.join('\n')
        }));
        await DpTaskService.update({
            id: taskId,
            status: DpTaskState.IN_PROGRESS,
            progress: 'AI is analyzing...'
        });

        const resStream = await chain.stream({
            s: sentence,
            p: point.join('\n')
        });
        await ChatService.processJsonResp(taskId, resStream);
    }

    public static async summary(taskId: number, sentences: string[]) {
        if (!await this.rateLimiter.limitRate(taskId)) return;
        const schema = z.object({
            summary: z.string().describe("The summary of content, in Chinese, length should be around 100 characters"),
        });

        const extractionFunctionSchema = {
            name: "extractor",
            description: "Extracts fields from the input.",
            parameters: zodToJsonSchema(schema),
        };
        // Instantiate the parser
        const parser = new JsonOutputFunctionsParser();
        const chat: ChatOpenAI = (await this.getOpenAi(taskId))
        if (!chat) return;
        const runnable = chat.bind({
            functions: [extractionFunctionSchema],
            function_call: {name: "extractor"},
        })
        const prompt = ChatPromptTemplate.fromTemplate(summaryPrompt);
        const chain = prompt
            .pipe(runnable)
            .pipe(parser);
        console.log(await prompt.format({
            s: sentences.join('\n'),
        }));
        await DpTaskService.update({
            id: taskId,
            status: DpTaskState.IN_PROGRESS,
            progress: 'AI is analyzing...'
        });

        const resStream = await chain.stream({
            s: sentences.join('\n'),
        });
        await ChatService.processJsonResp(taskId, resStream);
    }


    public static async synonymousSentence(taskId: number, sentence: string) {
        if (!await this.rateLimiter.limitRate(taskId)) return;
        const schema = z.object({
            sentences: z.array(z.string()).describe("A list of synonymous sentences for the input sentence, length should be 3"),
        });

        const extractionFunctionSchema = {
            name: "extractor",
            description: "Extracts fields from the input.",
            parameters: zodToJsonSchema(schema),
        };
        // Instantiate the parser
        const parser = new JsonOutputFunctionsParser();
        const chat: ChatOpenAI = (await this.getOpenAi(taskId))
        if (!chat) return;
        const runnable = chat.bind({
            functions: [extractionFunctionSchema],
            function_call: {name: "extractor"},
        })
        const prompt = ChatPromptTemplate.fromTemplate(synonymousSentence);
        const chain = prompt
            .pipe(runnable)
            .pipe(parser);
        await DpTaskService.update({
            id: taskId,
            status: DpTaskState.IN_PROGRESS,
            progress: 'AI is analyzing...'
        });

        const resStream = await chain.stream({
            s: sentence,
        });
        await ChatService.processJsonResp(taskId, resStream);
    }

    /**
     * 意群
     * @param taskId
     * @param sentence
     * @param phraseGroup
     */
    public static async phraseGroup(taskId: number, sentence: string, phraseGroup?: string) {
        if (!await this.rateLimiter.limitRate(taskId)) return;

        const schema = z.object({
            sentence: z.string().describe("The complete sentence from which phrase groups are derived."),
            phraseGroups: z.array(
                z.object({
                    original: z.string().describe("The original text of the phrase group."),
                    translation: z.string().describe("The translation of the original phrase group into another language. in Chinese."),
                    comment: z.string().describe("The role or function that the phrase group serves within the larger sentence structure. in Chinese."),
                })
            ).describe("An array of phrase groups that compose the sentence."),
        });

        const extractionFunctionSchema = {
            name: "extractor",
            description: "Extracts fields from the input.",
            parameters: zodToJsonSchema(schema),
        };
        // Instantiate the parser
        const parser = new JsonOutputFunctionsParser();
        const chat: ChatOpenAI = (await this.getOpenAi(taskId))
        if (!chat) return;
        const runnable = chat.bind({
            functions: [extractionFunctionSchema],
            function_call: {name: "extractor"},
        })
        const prompt = ChatPromptTemplate.fromTemplate(phraseGroupPrompt);
        const chain = prompt
            .pipe(runnable)
            .pipe(parser);
        await DpTaskService.update({
            id: taskId,
            status: DpTaskState.IN_PROGRESS,
            progress: 'AI is analyzing...'
        });

        console.log('seeeeeeeee', sentence, phraseGroup);
        const resStream = await chain.stream({
            s: sentence,
        });
        await ChatService.processJsonResp(taskId, resStream);
    }

    private static async processJsonResp(taskId: number, resStream: IterableReadableStream<any>) {
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


    /**
     * 断句
     * 当前字幕行所在的句子可能被换行打断, 尝试找出完整的句子
     * @param taskId
     * @param no
     * @param fullSrt
     */
    public static async punctuation(taskId: number, no: number, fullSrt: string) {
        console.log('punctuation', no, fullSrt);
        const sentence = getSubtitleContent(fullSrt, no);
        const srt = srtSlice(fullSrt, no, 5);
        console.log('ssssss', sentence, srt);
        if (!await this.rateLimiter.limitRate(taskId)) return;
        const schema = z.object({
            isComplete: z.boolean().describe('是完整的吗'),
            completeVersion: z.string().describe("完整的句子"),
        });
        const extractionFunctionSchema = {
            name: "extractor",
            description: "Extracts fields from the input.",
            parameters: zodToJsonSchema(schema),
        };
        // Instantiate the parser
        const parser = new JsonOutputFunctionsParser();
        const chat: ChatOpenAI = (await this.getOpenAi(taskId))
        if (!chat) return;
        const runnable = chat.bind({
            functions: [extractionFunctionSchema],
            function_call: {name: "extractor"},
        })

        const prompt = ChatPromptTemplate.fromTemplate(promptPunctuation);
        await DpTaskService.update({
            id: taskId,
            status: DpTaskState.IN_PROGRESS,
            progress: 'AI is analyzing...'
        });

        const chain = prompt
            .pipe(runnable)
            .pipe(parser);

        const resp : AiPunctuationResp[] = [];

        // const resStream = await chain.stream({
        //     srt,
        //     sentence
        // });
        // 调用两次
        await Promise.all([

            async () => {
                const r1 = await chain.invoke({
                    srt,
                    sentence
                });
                resp.push(r1 as AiPunctuationResp);
            },
            async () => {
                const r2 = await chain.invoke({
                    srt,
                    sentence
                });
                resp.push(r2 as AiPunctuationResp);
            }
        ]);
        const resp2  = resp.filter(r=>{
           return  r.isComplete === false && r.completeVersion !== sentence;
        });
        if (resp2.length>0) {
            await DpTaskService.update({
                id: taskId,
                status: DpTaskState.DONE,
                progress: 'AI has responded',
                result: JSON.stringify(resp2[0])
            });
        } else {
            await DpTaskService.update({
                id: taskId,
                status: DpTaskState.DONE,
                progress: 'AI has responded',
                result: JSON.stringify(resp[0])
            });
        }
    }
}

