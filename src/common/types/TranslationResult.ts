export type TranslationProvider = 'tencent' | 'openai';

export type TranslationMode = 'zh' | 'simple_en';

export type RendererTranslationItem = {
    key: string;
    translation: string;
    provider: TranslationProvider;
    mode?: TranslationMode;
    isComplete?: boolean;
};
