// const schema = z.object({
//     summary: z.string().describe("The summary of content, in Chinese, length should be around 100 characters"),
// });
export interface AiSummaryRes {
    summary: string;
}
