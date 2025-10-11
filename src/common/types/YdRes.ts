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

export interface OpenAIDictionaryExample {
    sentence: string;
    translation?: string;
    explanation?: string;
}

export interface OpenAIDictionaryDefinition {
    partOfSpeech?: string;
    meaning: string;
    explanation?: string;
    translationNote?: string;
    synonyms?: string[];
    antonyms?: string[];
    relatedPhrases?: string[];
    examples?: OpenAIDictionaryExample[];
}

export interface OpenAIDictionaryResult {
    word: string;
    phonetic?: string;
    ukPhonetic?: string;
    usPhonetic?: string;
    definitions: OpenAIDictionaryDefinition[];
    examples?: OpenAIDictionaryExample[];
    pronunciation?: string;
}
