//        const schema = z.object({
//             hasNewWord: z.boolean().describe("Whether the sentence contains new words for an intermediate English speaker"),
//             words: z.array(
//                 z.object({
//                     word: z.string().describe("The word"),
//                     phonetic: z.string().describe("The phonetic of the word"),
//                     meaning: z.string().describe("The meaning of the word in Chinese"),
//                 })
//             ).describe("A list of new words for an intermediate English speaker, if none, it should be an empty list"),
//         });
export interface AiAnalyseNewPhrasesRes {
    hasNewPhrase: boolean;
    phrases: {
        phrase: string;
        meaning: string;
    }[];
}
