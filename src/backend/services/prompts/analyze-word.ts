const analyzeWordsPrompt = (s:string):string =>
`从句子中找出中等英文水平的人可能不懂的单词, 并给出对应的中文翻译.

${s}
`
export default analyzeWordsPrompt;
