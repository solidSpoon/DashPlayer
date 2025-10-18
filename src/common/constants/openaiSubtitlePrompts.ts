import { TranslationMode } from '@/common/types/TranslationResult';

type PromptContext = {
    current: string;
    prev?: string;
    next?: string;
    style?: string;
};

export const OPENAI_SUBTITLE_BASE_PROMPT = `You are a professional subtitle assistant.

Follow these style guidelines closely:
{{style}}

Use the surrounding context to keep the tone, intent, and terminology aligned.

Previous sentence: "{{prev}}"
Next sentence: "{{next}}"

Only output the processed form of this sentence:
"{{current}}"`;

export const OPENAI_SUBTITLE_DEFAULT_STYLES: Record<TranslationMode, string> = {
    zh: '将原句自然、口语化地翻译成简体中文，语序可适度调整以保证流畅易读，保留原句语气与情感。',
    simple_en: '使用简洁易懂的英文重写字幕，尽量保留原有语序和标点，仅将难懂词汇替换为常见表达，同时保持原意与语气。',
    custom: '将原句自然、口语化地翻译成简体中文，语序可适度调整以保证流畅易读，保留原句语气与情感。',
};

export const OPENAI_SUBTITLE_CUSTOM_STYLE_KEY = 'subtitle.openai.customStyle';

const formatContextValue = (value?: string): string =>
    value && value.trim().length > 0 ? value : '(None)';

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

export const getSubtitlePromptTemplate = (): string => OPENAI_SUBTITLE_BASE_PROMPT;

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

export const fillSubtitlePrompt = (
    template: string,
    context: PromptContext,
    fallbackStyle?: string
): string => {
    const safeTemplate = template ?? '';
    const resolvedStyle = formatStyleValue(context.style, fallbackStyle ?? OPENAI_SUBTITLE_DEFAULT_STYLES.custom);

    return safeTemplate
        .replace(/{{\s*current\s*}}/gi, context.current ?? '')
        .replace(/{{\s*prev\s*}}/gi, formatContextValue(context.prev))
        .replace(/{{\s*next\s*}}/gi, formatContextValue(context.next))
        .replace(/{{\s*style\s*}}/gi, resolvedStyle);
};
