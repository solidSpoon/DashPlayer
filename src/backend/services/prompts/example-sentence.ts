const exampleSentences = (ps: string[]) :string=>
`你现在是一个英语学习程序，我会给你一些知识点, 你需要根据这些知识点来生成 5 个例句, 来帮助用户理解知识点
例句中的单词应该中等难度, 不应该太难或太简单, 你需要确保例句的语法正确 .

注意, 你必须生成 5 个例句

知识点:
${ps.join('\n')}
`
export default exampleSentences;
