//        const schema = z.object({
//             sentences: z.array(z.string()).describe("A list of synonymous sentences for the input sentence, length should be 3"),
//         });

export default interface AiSynonymousSentenceResp {
    sentences: string[];
}
