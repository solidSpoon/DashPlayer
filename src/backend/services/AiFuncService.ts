import {ChatOpenAI} from '@langchain/openai';
import DpTaskService from '@/backend/services/DpTaskService';
import {DpTaskState} from '@/backend/db/tables/dpTask';
import {
    ChatPromptTemplate,
} from '@langchain/core/prompts';
import analyzeWordsPrompt from "@/backend/services/prompts/analyze-word";
import {z} from "zod";
import {zodToJsonSchema} from "zod-to-json-schema";
import {JsonOutputFunctionsParser} from "langchain/output_parsers";
import exampleSentences from "@/backend/services/prompts/example-sentence";
import analyzeParasesPrompt from './prompts/analyze-phrases';
import synonymousSentence from "@/backend/services/prompts/synonymous-sentence";
import phraseGroupPrompt from "@/backend/services/prompts/phraseGroupPropmt";
import promptPunctuation from "@/backend/services/prompts/prompt-punctuation";
import {getSubtitleContent, srtSlice} from "@/common/utils/srtSlice";
import AiPunctuationResp from "@/common/types/aiRes/AiPunctuationResp";
import analyzeGrammerPrompt from '@/backend/services/prompts/analyze-grammer';
import AiFunc from "@/backend/services/AiFuncs/ai-func";
import RateLimiter from "@/common/utils/RateLimiter";

export default class AiFuncService {
    public static async analyzeWord(taskId: number, sentence: string) {
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
        await AiFunc.run(taskId, schema, analyzeWordsPrompt(sentence));
    }

    public static async analyzePhrase(taskId: number, sentence: string) {
        const schema = z.object({
            hasNewPhrase: z.boolean().describe("Whether the sentence contains new phrases for an intermediate English speaker"),
            phrases: z.array(
                z.object({
                    phrase: z.string().describe("The phrase"),
                    meaning: z.string().describe("The meaning of the phrase in Chinese, Because it is for Chinese, who may not understand English well, so the meaning is in Chinese"),
                })
            ).describe("A list of new phrases for an intermediate English speaker, if none, it should be an empty list"),
        });

        await AiFunc.run(taskId, schema, analyzeParasesPrompt(sentence));
    }

    public static async analyzeGrammer(taskId: number, sentence: string) {
        const schema = z.object({
            hasGrammar: z.boolean().describe("Whether the sentence contains grammar for an intermediate English speaker"),
            grammars: z.array(
                z.object({
                    description: z.string().describe("The description of the grammar"),
                })
            ).describe("A list of grammar for an intermediate English speaker, if none, it should be an empty list"),
        });


        await AiFunc.run(taskId, schema, analyzeGrammerPrompt(sentence));

    }

    public static async makeSentences(taskId: number, sentence: string, point: string[]) {
        const schema = z.object({
            sentences: z.array(
                z.object({
                    sentence: z.string().describe("The example sentence"),
                    meaning: z.string().describe("The meaning of the sentence in Chinese, Because it is for Chinese, who may not understand English well, so the meaning is in Chinese"),
                    points: z.array(z.string().describe("points you use in the sentence")),
                })
            ).describe("A list of example sentences for an intermediate English speaker. length should be 5"),
        });

        await AiFunc.run(taskId, schema, exampleSentences(point));

    }

    public static async synonymousSentence(taskId: number, sentence: string) {
        const schema = z.object({
            sentences: z.array(z.string()).describe("A list of synonymous sentences for the input sentence, length should be 3"),
        });
        await AiFunc.run(taskId, schema, synonymousSentence(sentence));
    }

    /**
     * 意群
     * @param taskId
     * @param sentence
     */
    public static async phraseGroup(taskId: number, sentence: string) {
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
        await AiFunc.run(taskId, schema, phraseGroupPrompt(sentence));
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
        await RateLimiter.wait('gpt');
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
        const chat: ChatOpenAI = (await AiFunc.getOpenAi(taskId))
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

        const resp: AiPunctuationResp[] = [];

        await Promise.all([

            (async () => {
                const r = await chain.invoke({
                    srt,
                    sentence
                });
                resp.push(r as AiPunctuationResp);
            })(),
            (async () => {
                const r = await chain.invoke({
                    srt,
                    sentence
                });
                resp.push(r as AiPunctuationResp);
            })(),
            (async () => {
                const r = await chain.invoke({
                    srt,
                    sentence
                });
                resp.push(r as AiPunctuationResp);
            })()
        ]);
        const resp2 = resp.filter(r => {
            return (r.isComplete === false && r.completeVersion !== sentence) || r.isComplete === true
        });
        if (resp2.length > 0) {
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

