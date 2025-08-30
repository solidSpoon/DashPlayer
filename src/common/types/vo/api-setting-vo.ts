export type ApiSettingVO = {
    openai: {
        key: string;
        endpoint: string;
        model: string;
        enableSentenceLearning: boolean;
        enableSubtitleTranslation: boolean;
        enableDictionary: boolean;
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
};
