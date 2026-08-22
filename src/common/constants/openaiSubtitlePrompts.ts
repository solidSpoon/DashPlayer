import { TranslationMode } from '@/common/types/TranslationResult';

type BatchPromptItem = {
    key: string;
    text: string;
};

type SubtitleBatchPromptInput = {
    targets: BatchPromptItem[];
    contextBefore: BatchPromptItem[];
    contextAfter: BatchPromptItem[];
};

export const OPENAI_SUBTITLE_BATCH_PROMPT = `You are a professional subtitle translation assistant.

Follow these style guidelines closely:
{{style}}

You will receive target subtitle lines and optional surrounding context in JSON format.
Context lines (contextBefore and contextAfter) are READ-ONLY references to help understand tone, intent, and terminology.

Rules:
1. Return exactly one translation for every item in targets.
2. Copy every target key exactly; never change, omit, duplicate, or invent keys.
3. NEVER translate, include, or return contextBefore or contextAfter items.
4. Do not merge or split target lines.
5. Every translation must be a non-empty string. If a target should remain unchanged, return its original text.
6. Respond with valid JSON only in the following shape:
{"items":[{"key":"target_key","translation":"translated_text"}]}

Subtitle request:
{{request}}`;

export const OPENAI_SUBTITLE_DEFAULT_STYLES: Record<TranslationMode, string> = {
    zh: '将原句自然、口语化地翻译成简体中文，语序可适度调整以保证流畅易读，保留原句语气与情感。',
    simple_en: '使用简洁易懂的英文重写字幕，尽量保留原有语序和标点，仅将难懂词汇替换为常见表达，同时保持原意与语气。',
    custom: '将原句自然、口语化地翻译成简体中文，语序可适度调整以保证流畅易读，保留原句语气与情感。',
};

export const OPENAI_SUBTITLE_CUSTOM_STYLE_KEY = 'subtitle.openai.customStyle';

const normalizeStyle = (value: string): string =>
    value
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map(line => line.trim())
        .join('\n')
        .trim();

const hashString = (value: string): string => {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
        hash = (hash << 5) - hash + value.charCodeAt(i);
        hash |= 0;
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
};

const formatStyleValue = (value: string | undefined, fallback: string): string => {
    const trimmed = value ? value.trim() : '';
    return trimmed.length > 0 ? trimmed : fallback;
};

export const getSubtitleDefaultStyle = (mode: TranslationMode): string =>
    OPENAI_SUBTITLE_DEFAULT_STYLES[mode];

export const resolveSubtitleStyle = (mode: TranslationMode, customStyle?: string): string => {
    if (mode === 'custom') {
        return formatStyleValue(customStyle, OPENAI_SUBTITLE_DEFAULT_STYLES.custom);
    }
    return OPENAI_SUBTITLE_DEFAULT_STYLES[mode];
};

export const resolveSubtitleStyleWithSignature = (
    mode: TranslationMode,
    customStyle?: string
): { style: string; signature: string } => {
    const style = resolveSubtitleStyle(mode, customStyle);
    const normalized = normalizeStyle(style);
    const signature = `${mode}_${hashString(`${mode}::${normalized}`)}`;
    return { style, signature };
};

/**
 * 生成字幕窗口批量翻译提示词。
 *
 * @param input 当前批次的目标字幕与只读上下文。
 * @param style 风格约束文本。
 * @returns 可直接发送给 OpenAI 的批量翻译 prompt。
 */
export const buildSubtitleBatchPrompt = (input: SubtitleBatchPromptInput, style: string): string => {
    return OPENAI_SUBTITLE_BATCH_PROMPT
        .replace(/{{\s*style\s*}}/gi, formatStyleValue(style, OPENAI_SUBTITLE_DEFAULT_STYLES.custom))
        .replace(/{{\s*request\s*}}/gi, JSON.stringify(input, null, 2));
};
