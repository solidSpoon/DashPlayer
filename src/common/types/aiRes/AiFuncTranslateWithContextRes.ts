import { z } from 'zod';
import { codeBlock } from 'common-tags';
export class AiFuncTranslateWithContextPrompt {
    public static promptFunc(sentence: string, context: string[]):string {
        return codeBlock`
        你是一个翻译官，你会根据上下文把指定句子翻译成中文。

        上下文:
        ${context.join('\n')}

        请根据上下文翻译这句话:
        ${sentence}
        `
    }

    public static schema = z.object({
        translation: z.string().describe('The translation of the sentence. in Chinese(简体中文)'),
    });
}

export type AiFuncTranslateWithContextRes = z.infer<typeof AiFuncTranslateWithContextPrompt['schema']>;
