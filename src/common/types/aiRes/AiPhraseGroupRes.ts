import { codeBlock } from 'common-tags';
import { z } from 'zod';

export class AiPhraseGroupPrompt {
    public static promptFunc(text: string):string {
        return codeBlock`
        分析下面三个单引号包裹的英文句子的意群。将这个句子按照意群拆分成多个短句，每个短句是一个意群。
        请在 tags 为该意群打标签，可以包括任何你认为有用的信息。
        '''
        ${text}
        '''
        `
    }
    public static schema = z.object({
        sentence: z.string().describe("The complete sentence from which phrase groups are derived."),
        phraseGroups: z.array(
            z.object({
                original: z.string().describe("The original text of the phrase group."),
                translation: z.string().describe("The translation of the phrase group. in Chinese(简体中文)."),
                tags: z.array(z.string()).optional().describe("A list of tags to categorize the phrase group. in Chinese(简体中文)."),
            })
        ).describe("An array of phrase groups that compose the sentence."),
    });
}
export type AiPhraseGroupRes = z.infer<typeof AiPhraseGroupPrompt['schema']>;

// 意群数组中的每个元素
export type AiPhraseGroupElement = AiPhraseGroupRes['phraseGroups'][0];
