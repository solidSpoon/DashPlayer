import { z } from 'zod';

export const AiUnifiedAnalysisSchema = z.object({
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
});

export type AiUnifiedAnalysisRes = z.infer<typeof AiUnifiedAnalysisSchema>;
