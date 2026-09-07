/** 字幕结果来源，本地推理与云端分别缓存。 */
export type TranslationProvider = 'tencent' | 'openai' | 'local';

export type TranslationMode = 'zh' | 'simple_en' | 'custom';

/**
 * 渲染层使用的字幕翻译条目。
 * 说明：`key` 固定为 renderer 定位键（`fileHash:index`），用于前后端按句对齐结果；
 * 翻译缓存按句子内容派生键，与该键无关。
 */
export type RendererTranslationItem = {
    /** renderer 定位键，格式为 `fileHash:index`。 */
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
