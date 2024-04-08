// const schema = z.object({
//     hasGrammer: z.boolean().describe("Whether the sentence contains grammer for an intermediate English speaker"),
//     grammers: z.array(
//         z.object({
//             description: z.string().describe("The description of the grammer"),
//         })
//     ).describe("A list of grammer for an intermediate English speaker, if none, it should be an empty list"),
// });
export interface AiAnalyseGrammersRes {
    hasGrammer: boolean;
    grammers: {
        description: string;
    }[];
}
