// const schema = z.object({
//     sentences: z.object({
//         break: z.boolean().describe("Whether the sentence is broken into multiple lines"),
//         sentence: z.string().describe("The complete sentence"),
//     }).describe("Analyse whether the sentence is broken into multiple lines and return the complete sentence"),
// });

// const promptPunctuation =
// `你现在是一个英语学习播放器, 播放器当前字幕可能被换行打断成多行, 不利于用户理解, 我把当前字幕行和它的上下文给你, 请你分析一下这个句子, 看看这个句子是否被换行打断成多行, 如果是, 请你把这个句子合并成一个完整的句子.
// 为了避免混淆, 我会将上下文和当前句子用三个单引号包裹
//
// 上下文:'''
// {context}
// '''
//
// 这个句子是:'''
// {sentence}
// '''
//
// 请你判断这个句子是否被换行打断成多行, 如果是, 请你把这个句子合并成一个完整的句子.
// `

const promptPunctuation = `
{time}
A complete sentence may be broken into multiple lines due to various reasons.
Given the isolated sentence below, use context to determine if it is a subpart of a complete sentence. try to provide a complete version of the sentence by combining the isolated sentence with the context.
Remember to consider the grammatical structure and the meaning conveyed by the words in the context and the sentence.

sentence'''
{sentence}
'''

context'''
{context}
'''
`

export default promptPunctuation;
