export type TranslationProvider = 'tencent' | 'openai';

export type TranslationMode = 'zh' | 'simple_en' | 'custom';

/**
 * 渲染层使用的字幕翻译条目。
 * 说明：`key` 固定为稳定句子键（`fileHash:index`），用于前后端按句对齐结果。
 */
export type RendererTranslationItem = {
    /** 稳定句子键，格式为 `fileHash:index`。 */
    key: string;
    /** 当前字幕文件哈希，用于过滤跨文件的过期结果。 */
    fileHash: string;
    /** 翻译文本。 */
    translation: string;
    /** 结果来源 provider。 */
    provider: TranslationProvider;
    /** OpenAI 场景下的模式；腾讯固定视为 `zh`。 */
    mode?: TranslationMode;
};
