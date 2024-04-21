const analyzePhrasesPrompt = (s:string):string =>
`你正在帮助用户学习英语。从句子中找出词组/短语/固定搭配, 并给出对应的中文翻译.

${s}
`
export default analyzePhrasesPrompt;
