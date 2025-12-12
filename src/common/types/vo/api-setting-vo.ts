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
        modelSize: 'base' | 'large';
        enableVad: boolean;
        vadModel: 'silero-v5.1.2' | 'silero-v6.2.0';
    };
};
