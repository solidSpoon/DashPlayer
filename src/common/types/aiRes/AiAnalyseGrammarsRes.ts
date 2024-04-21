import { z } from 'zod';
import { codeBlock } from 'common-tags';


export class AiAnalyseGrammarsPrompt {
    public static schema = z.object({
        hasGrammar: z.boolean().describe('whether the sentence has grammar'),
        grammarsMd: z.string().describe('explain result, must be in Chinese(简体中文), markdown format'),
    });

    public static promptFunc = (s: string) => codeBlock`
        You are a professional grammar analyzer, your job is helping Chinese people learn English grammar.

        """sentence
        ${s}
        """

        Please explain the grammar of the above sentence using Chinese(简体中文), use markdown format to give a clear explanation.
        `;
}

export type AiAnalyseGrammarsRes = z.infer<typeof AiAnalyseGrammarsPrompt['schema']>;

