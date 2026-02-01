export type FeatureServiceRoutingVO = {
    subtitleTranslation: {
        provider: 'disabled' | 'openai' | 'tencent';
        openai: {
            mode: 'zh' | 'simple_en' | 'custom';
            customStyle: string;
        };
    };
    dictionary: {
        provider: 'disabled' | 'openai' | 'youdao';
    };
    transcription: {
        provider: 'disabled' | 'openai' | 'whisper';
    };
    sentenceLearning: {
        enabled: boolean;
    };
};

