import { codeBlock } from 'common-tags';
import { z } from 'zod';

export class AiFuncPunctuationPrompt {
    public static promptFunc(sentence: string, srt: string) {
        return codeBlock`
        '''srt
        ${srt}
        '''
        ${sentence}这行是完整的吗? 如果不是, 完整的句子是什么?
        `;
    }

    public static schema =  z.object({
        isComplete: z.boolean().describe('是完整的吗'),
        completeVersion: z.string().describe("完整的句子"),
    });
}

export type AiFuncPunctuationRes = z.infer<typeof AiFuncPunctuationPrompt['schema']>;
