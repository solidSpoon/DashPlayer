interface ApiDefinition {
    'main-state': { params: string, return: number },
    'setting-state': { params: number, return: number },
    // 其他路径...
}
// 定义额外的接口
interface AiFuncDef {
    'ai-func/tts': { params: string, return: string }
    'ai-func/phrase-group': { params: string, return: number }
    'ai-func/synonymous-sentence': { params: string, return: number }
    'ai-func/make-example-sentences': { params: { sentence: string, point: string[] }, return: number }
    'ai-func/punctuation': { params: { no: number, srt: string }, return: number }
    'ai-func/analyze-grammars': { params: string, return: number }
    'ai-func/analyze-new-phrases': { params: string, return: number }
    'ai-func/analyze-new-words': { params: string, return: number }

}

// 使用交叉类型合并 ApiDefinitions 和 ExtraApiDefinition
export type ApiDefinitions = ApiDefinition & AiFuncDef;

// 更新 ApiMap 类型以使用 CombinedApiDefinitions
export type ApiMap = {
    [K in keyof ApiDefinitions]: ApiFunction<ApiDefinitions[K]['params'], Promise<ApiDefinitions[K]['return']>>;
}

// 定义函数类型
type ApiFunction<P, R> = (params: P) => R;
