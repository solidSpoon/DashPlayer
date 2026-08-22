import { z } from 'zod';

export const AiUnifiedAnalysisSchema = z.object({
    structure: z.object({
        phraseGroups: z.array(z.string()).describe('Phrase groups that compose the sentence in natural reading order.'),
    }),
    vocab: z.object({
        hasNewWord: z.boolean().describe('Whether the sentence has new words for an intermediate English learner.'),
        words: z.array(
            z.object({
                word: z.string().describe('The word.'),
                phonetic: z.string().describe('The phonetic of the word.'),
                meaning: z.string().describe('The meaning of the word in Chinese.'),
            })
        ).describe('List of new words, can be empty.'),
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
    examples: z.object({
        sentences: z.array(
            z.object({
                sentence: z.string().describe('Example sentence in English.'),
                meaning: z.string().describe('Meaning in Chinese(简体中文).'),
                points: z.array(z.string()).describe('Points or words used in the sentence.'),
            })
        ).describe('Example sentences.'),
    }),
});

export type AiUnifiedAnalysisRes = z.infer<typeof AiUnifiedAnalysisSchema>;
