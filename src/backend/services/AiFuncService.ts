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
import analyzePhrasesPrompt from './prompts/analyze-phrases';
import synonymousSentence from "@/backend/services/prompts/synonymous-sentence";
import phraseGroupPrompt from "@/backend/services/prompts/phraseGroupPropmt";
import promptPunctuation from "@/backend/services/prompts/prompt-punctuation";
import AiFunc from "@/backend/services/AiFuncs/ai-func";
import RateLimiter from "@/common/utils/RateLimiter";
import { AiFuncPolishPrompt } from '@/common/types/aiRes/AiFuncPolish';
import { AiAnalyseGrammarsPrompt } from '@/common/types/aiRes/AiAnalyseGrammarsRes';
import { AiFuncExplainSelectWithContextPrompt } from '@/common/types/aiRes/AiFuncExplainSelectWithContextRes';
import { AiFuncExplainSelectPrompt } from '@/common/types/aiRes/AiFuncExplainSelectRes';
import {AiFuncFormatSplitPrompt} from "@/common/types/aiRes/AiFuncFormatSplit";
import ChatService from "@/backend/services/ChatService";
import {HumanMessage} from "@langchain/core/messages";
import { AiPhraseGroupPrompt } from '@/common/types/aiRes/AiPhraseGroupRes';
import { AiFuncTranslateWithContextPrompt } from '@/common/types/aiRes/AiFuncTranslateWithContextRes';
import { AiFuncPunctuationPrompt } from '@/common/types/aiRes/AiPunctuationResp';
import { getSubtitleContent, srtSlice } from '@/common/utils/srtSlice';

export default class AiFuncService {

    public static async polish(taskId: number, sentence: string) {
        await AiFunc.run(taskId, AiFuncPolishPrompt.schema, AiFuncPolishPrompt.promptFunc(sentence));
    }

    public static async formatSplit(taskId: number, text: string) {
        // await AiFunc.run(taskId, null, AiFuncFormatSplitPrompt.promptFunc(text));
        await ChatService.chat(taskId, [new HumanMessage(AiFuncFormatSplitPrompt.promptFunc(text))])
    }

    public static async analyzeWord(taskId: number, sentence: string) {
        const schema = z.object({
            hasNewWord: z.boolean().describe("是否包含中等难度及以上的单词"),
            words: z.array(
                z.object({
                    word: z.string().describe("The word"),
                    phonetic: z.string().describe("The phonetic of the word"),
                    meaning: z.string().describe("The meaning of the word in Chinese(简体中文)"),
                })
            ).describe("A list of new words for an intermediate English speaker, if none, it should be an empty list"),
        });
        await AiFunc.run(taskId, schema, analyzeWordsPrompt(sentence));
    }

    public static async analyzePhrase(taskId: number, sentence: string) {
        const schema = z.object({
            hasPhrase: z.boolean().describe("这个句子是否包含 短语/词组/固定搭配"),
            phrases: z.array(
                z.object({
                    phrase: z.string().describe("短语/词组/固定搭配"),
                    meaning: z.string().describe("The meaning of the phrase in Chinese(简体中文)"),
                })
            ).describe("A list of phrases for an intermediate English speaker, if none, it should be an empty list"),
        });

        await AiFunc.run(taskId, schema, analyzePhrasesPrompt(sentence));
    }

    public static async analyzeGrammar(taskId: number, sentence: string) {

        //去掉换行
        sentence = sentence.replaceAll(/\n/g, ' ');
        const promptStr = AiAnalyseGrammarsPrompt.promptFunc(sentence);
        console.log('promptStr', promptStr);
        await AiFunc.run(taskId, AiAnalyseGrammarsPrompt.schema, promptStr);
    }

    public static async makeSentences(taskId: number, sentence: string, point: string[]) {
        const schema = z.object({
            sentences: z.array(
                z.object({
                    sentence: z.string().describe("The example sentence"),
                    meaning: z.string().describe("The meaning of the sentence in Chinese(简体中文)"),
                    points: z.array(z.string().describe("related points in the sentence"))
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
        await AiFunc.run(taskId, AiPhraseGroupPrompt.schema, AiPhraseGroupPrompt.promptFunc(sentence));
    }


    /**
     * 断句
     * 当前字幕行所在的句子可能被换行打断, 尝试找出完整的句子
     * @param taskId
     * @param no
     * @param fullSrt
     */
    public static async punctuation(taskId: number, no: number, fullSrt: string) {
        const sentence = getSubtitleContent(fullSrt, no);
        const srt = srtSlice(fullSrt, no, 5);
       await AiFunc.run(taskId, AiFuncPunctuationPrompt.schema, AiFuncPunctuationPrompt.promptFunc(sentence, srt));
    }

    static async explainSelect(taskId: number, word: string) {
        await AiFunc.run(taskId, AiFuncExplainSelectPrompt.schema, AiFuncExplainSelectPrompt.promptFunc(word));

    }
    public static async explainSelectWithContext(taskId: number, sentence: string, selectedWord: string) {
        await AiFunc.run(taskId, AiFuncExplainSelectWithContextPrompt.schema, AiFuncExplainSelectWithContextPrompt.promptFunc(sentence, selectedWord));
    }
    public static async translateWithContext(taskId: number, sentence: string, context: string[]) {
        await AiFunc.run(taskId, AiFuncTranslateWithContextPrompt.schema, AiFuncTranslateWithContextPrompt.promptFunc(sentence, context));
    }
}

