export interface YdRes {
    errorCode: string;
    query: string;
    isDomainSupport: string;
    translation: string[];
    basic: Basic;
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
