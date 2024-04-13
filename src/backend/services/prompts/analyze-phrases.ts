const analyzeParasesPrompt = (s:string):string =>
`你现在是一个英语学习程序，你的任务是帮助具有中等英文水平且母语是中文的人学习英语, 你需要从句子中找出中等英文水平的人可能不懂的短语, 并给出对应的中文翻译.

${s}
`
export default analyzeParasesPrompt;
