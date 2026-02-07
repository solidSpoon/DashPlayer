export type EngineSelectionSettingVO = {
    openai: {
        enableSentenceLearning: boolean;
        subtitleTranslationMode: 'zh' | 'simple_en' | 'custom';
        subtitleCustomStyle: string;
        featureModels: {
            sentenceLearning: string;
            subtitleTranslation: string;
            dictionary: string;
            transcription: string;
        };
    };
    providers: {
        subtitleTranslationEngine: 'openai' | 'tencent' | 'none';
        dictionaryEngine: 'openai' | 'youdao' | 'none';
        transcriptionEngine: 'openai' | 'whisper' | 'none';
    };
};
