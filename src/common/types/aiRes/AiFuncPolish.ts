import { z } from 'zod';
import { codeBlock } from 'common-tags';
export class AiFuncPolishPrompt {
    public static promptFunc(text: string):string {
        return codeBlock`
        Please edit the following sentences to improve clarity, conciseness, and coherence, making them match the expression of native speakers.

        句子："""
        ${text}
        """
        `
    }

    public static schema = z.object({
        edit1: z.string().describe('润色后的句子1'),
        edit2: z.string().describe('润色后的句子2'),
        edit3: z.string().describe('润色后的句子3'),
    }).describe('Polish the sentence in three ways');
}

export type AiFuncPolishRes = z.infer<typeof AiFuncPolishPrompt['schema']>;
