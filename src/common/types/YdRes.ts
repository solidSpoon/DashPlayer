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

export interface OpenAIDictionaryResult {
    word: string;
    phonetic?: string;
    ukPhonetic?: string;
    usPhonetic?: string;
    definitions: string[];
    examples?: string[];
    pronunciation?: string;
}
