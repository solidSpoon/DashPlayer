import { z } from 'zod';
import { codeBlock } from 'common-tags';


export class AiAnalyseGrammarsPrompt {
    public static schema = z.object({
        hasGrammar: z.boolean().describe('whether the sentence has grammar'),
        grammarsMd: z.string().describe('explain result, must be in Chinese(简体中文), markdown format'),
    });

    public static promptFunc = (s: string) => codeBlock`
        用中文分析下面句子包含的语法

        """sentence
        ${s}
        """

        你的回复只需要包含语法解释，不需要包含其他内容。
        用户的显示窗口比较小，所以请尽量简洁，但是不要遗漏重要的内容。
        使用精美的 Markdown 格式书写，以便于用户阅读。
        `;
}

export type AiAnalyseGrammarsRes = z.infer<typeof AiAnalyseGrammarsPrompt['schema']>;

