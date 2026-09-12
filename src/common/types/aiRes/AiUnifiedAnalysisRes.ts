import { z } from 'zod';

export const AiUnifiedAnalysisSchema = z.object({
    opening: z
        .string()
        .describe(
            'Opening walkthrough in Chinese markdown: one line on what is distinctive about the sentence, then 2~3 idiomatic rephrasings. Do not restate the sentence or its translation, the UI already shows both.'
        ),
    structure: z.object({
        phraseGroups: z.array(z.string()).describe('Phrase groups that compose the sentence in natural reading order.'),
    }),
    phrases: z.object({
        hasPhrase: z.boolean().describe('Whether the sentence has useful phrases.'),
        phrases: z.array(
            z.object({
                phrase: z.string().describe('The phrase.'),
                meaning: z.string().describe('The meaning of the phrase in Chinese.'),
            })
        ).describe('List of phrases, can be empty.'),
    }),
    grammar: z.object({
        hasGrammar: z.boolean().describe('Whether the sentence has grammar points.'),
        grammarsMd: z.string().describe('Grammar explanation in Chinese(简体中文), markdown format.'),
    }),
});

export type AiUnifiedAnalysisRes = z.infer<typeof AiUnifiedAnalysisSchema>;
