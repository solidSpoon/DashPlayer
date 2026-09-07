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
 *
 * 说明：
 * - 该结构同时承载 AI 生成与预置词典（ECDICT）两种数据来源的单词卡；
 * - 词库元信息字段（collins/oxford/bnc/frq/tags）只有预置词典命中的结果才会填充，
 *   AI 生成结果不携带这些字段。
 */
export interface OpenAIDictionaryResult {
    /** 查询词。 */
    word: string;
    /** 音标（IPA），未知时为空字符串。 */
    phonetic: string;
    /** 释义列表，至少可能为空数组。 */
    definitions: OpenAIDictionaryDefinition[];
    /** Collins 词典星级（1-5，数值越大越常用），仅预置词典数据提供。 */
    collins?: number;
    /** Oxford 词典收录标记（0-3，>0 表示收录），仅预置词典数据提供。 */
    oxford?: number;
    /** BNC 语料库词频排名（1 起，越小越常用），仅预置词典数据提供。 */
    bnc?: number;
    /** COCA 语料库词频排名（1 起，越小越常用），仅预置词典数据提供。 */
    frq?: number;
    /** 考试大纲标签（zk/gk/cet4/cet6/ky/toefl/ielts/gre），仅预置词典数据提供。 */
    tags?: string[];
}
