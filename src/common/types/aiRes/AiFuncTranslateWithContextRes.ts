import { z } from 'zod';
import { codeBlock } from 'common-tags';
export class AiFuncTranslateWithContextPrompt {
    public static promptFunc(sentence: string, context: string[]):string {
        return codeBlock`
        你是一个翻译官，你会根据上下文把指定句子翻译成中文。

        上下文:
        """
        ${context.join('\n')}
        """


        请根据上下文把下面的句子翻译成中文。(简体中文)
        ${sentence}
        `
    }

    public static schema = z.object({
        original: z.string().describe('句子的原文'),
        translation: z.string().describe('句子的中文翻译，该字段语言为简体中文'),
    });
}

export type AiFuncTranslateWithContextRes = z.infer<typeof AiFuncTranslateWithContextPrompt['schema']>;
