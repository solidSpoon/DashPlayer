export type ApiSettingVO = {
    openai: {
        key: string;
        endpoint: string;
        model: string;
        enableSentenceLearning: boolean;
        enableSubtitleTranslation: boolean;
        subtitleTranslationMode: 'zh' | 'simple_en' | 'custom';
        subtitleCustomStyle: string;
        enableDictionary: boolean;
        enableTranscription: boolean;
    };
    tencent: {
        secretId: string;
        secretKey: string;
        enableSubtitleTranslation: boolean;
    };
    youdao: {
        secretId: string;
        secretKey: string;
        enableDictionary: boolean;
    };
    whisper: {
        enabled: boolean;
        enableTranscription: boolean;
    };
};
