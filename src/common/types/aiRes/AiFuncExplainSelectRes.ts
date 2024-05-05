import { z } from 'zod';
import { codeBlock } from 'common-tags';
export class AiFuncExplainSelectPrompt {
    public static promptFunc(word: string):string {
        return codeBlock`
        你是一个专业的在线双语词典，你的工作是帮助中文用户理解英文的 单词/短语。
        请解释 "${word}" 这个 单词/短语 并用这个 单词/短语 造三个例句。
        `
    }

    public static schema = z.object({
        word: z.object({
            word: z.string().describe('单词/短语原文'),
            phonetic: z.string().describe('单词/短语的音标'),
            meaningEn: z.string().describe('单词/短语的英文释意'),
            meaningZh: z.string().describe('单词/短语的中文释意'),
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

export type AiFuncExplainSelectRes = z.infer<typeof AiFuncExplainSelectPrompt['schema']>;
