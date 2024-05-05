// const schema = z.object({
//     sentences: z.object({
//         break: z.boolean().describe("Whether the sentence is broken into multiple lines"),
//         sentence: z.string().describe("The complete sentence"),
//     }).describe("Analyse whether the sentence is broken into multiple lines and return the complete sentence"),
// });
export default interface AiPunctuationResp {
    isComplete: boolean;
    completeVersion: string;
}
