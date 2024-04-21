const phraseGroupPrompt = (s: string): string => `
分析下面三个单引号包裹的英文句子的意群，最好包括主语、谓语、宾语、定语、状语、补语等成分。

'''
${s}
'''
`

export default phraseGroupPrompt;
