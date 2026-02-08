export interface YdRes {
    errorCode: string;
    query: string;
    isDomainSupport: string;
    translation: string[];
    basic: Basic;
    webdict: {
        "url": string;
    },
    l: string;
    tSpeakUrl: string;
    speakUrl: string;
}

export interface Basic {
    exam_type: string[];
    phonetic: string;
    'uk-phonetic': string;
    'us-phonetic': string;
    'uk-speech': string;
    'us-speech': string;
    explains: string[];
}

/**
 * OpenAI 字典中的例句项。
 */
export interface OpenAIDictionaryExample {
    /** 英文例句原文。 */
    sentence: string;
    /** 例句中文翻译。 */
    translation: string;
}

/**
 * OpenAI 字典中的释义项。
 */
export interface OpenAIDictionaryDefinition {
    /** 词性（如 noun/verb/adj），未知时为空字符串。 */
    partOfSpeech: string;
    /** 中文释义。 */
    meaning: string;
    /** 与该释义对应的例句列表。 */
    examples: OpenAIDictionaryExample[];
}

/**
 * OpenAI 单词卡返回结构（简化版）。
 */
export interface OpenAIDictionaryResult {
    /** 查询词。 */
    word: string;
    /** 音标（IPA），未知时为空字符串。 */
    phonetic: string;
    /** 释义列表，至少可能为空数组。 */
    definitions: OpenAIDictionaryDefinition[];
}
