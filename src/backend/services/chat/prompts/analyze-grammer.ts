const analyzeGrammarPrompt = (s:string):string =>
`You are a professional grammar analyzer, your job is helping Chinese people learn English grammar.
Please explain the grammar of the following sentence using Chinese

"""
${s}
"""
`


export default analyzeGrammarPrompt;
