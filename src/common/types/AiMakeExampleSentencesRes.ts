//        const schema = z.object({
//             sentences: z.array(
//                 z.object({
//                     sentence: z.string().describe("The example sentence"),
//                     meaning: z.string().describe("The meaning of the sentence in Chinese, Because it is for Chinese, who may not understand English well, so the meaning is in Chinese"),
//                     point: z.array(z.string().describe("points you use in the sentence")),
//                 })
//             ).describe("A list of example sentences for an intermediate English speaker"),
//         });

export interface AiMakeExampleSentencesRes {
    sentences: {
        sentence: string;
        meaning: string;
        points: string[];
    }[];
}
