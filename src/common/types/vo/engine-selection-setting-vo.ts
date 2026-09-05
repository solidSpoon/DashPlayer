/** 字幕、词典与整句学习的引擎和模型设置。 */
export type EngineSelectionSettingVO = {
    openai: {
        enableSentenceLearning: boolean;
        subtitleTranslationMode: 'zh' | 'simple_en' | 'custom';
        subtitleCustomStyle: string;
        featureModels: {
            sentenceLearning: string;
            subtitleTranslation: string;
            dictionary: string;
        };
    };
    providers: {
        subtitleTranslationEngine: 'openai' | 'local' | 'tencent' | 'none';
        dictionaryEngine: 'openai' | 'local' | 'youdao' | 'none';
    };
};
