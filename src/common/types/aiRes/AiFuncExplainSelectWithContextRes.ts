import { z } from 'zod';
import { codeBlock } from 'common-tags';
export class AiFuncExplainSelectWithContextPrompt {
    public static promptFunc(text: string, selectedWord: string):string {
        return codeBlock`
        你的任务是帮助中等英文水平的中文用户理解英文句子中的单词/短语。请根据句子解释单词/短语，并用这个单词/短语造三个例句。

        句子："""
        ${text}
        """

        请根据这个句子解释 "${selectedWord}" 这个 单词/短语 并用这个 单词/短语 造三个例句。
        `
    }

    public static schema = z.object({
        sentence: z.object({
            sentence: z.string().describe('句子原文'),
            meaning: z.string().describe('句子的中文意思')
        }),
        word: z.object({
            word: z.string().describe('单词/短语原文'),
            phonetic: z.string().describe('单词/短语的音标'),
            meaningEn: z.string().describe('单词/短语的英文释意'),
            meaningZh: z.string().describe('单词/短语的中文释意'),
            meaningInSentence: z.string().describe('结合句子解释这个单词/短语的意思')
        }),
        // 例句
        examplesSentence1: z.string().describe('例句1'),
        examplesSentenceMeaning1: z.string().describe('例句1的中文释义'),
        examplesSentence2: z.string().describe('例句2'),
        examplesSentenceMeaning2: z.string().describe('例句2的中文释义'),
        examplesSentence3: z.string().describe('例句3'),
        examplesSentenceMeaning3: z.string().describe('例句3的中文释义'),
    });
}

export type AiFuncExplainSelectWithContextRes = z.infer<typeof AiFuncExplainSelectWithContextPrompt['schema']>;
