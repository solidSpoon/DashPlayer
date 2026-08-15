const phraseGroupPrompt = (s: string): string => `
分析下面三个单引号包裹的英文句子的意群，最好在 comment 字段指出意群在句子中的作用（主语 谓语 宾语 等）

'''
${s}
'''
`

export default phraseGroupPrompt;
