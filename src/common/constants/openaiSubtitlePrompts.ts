/**
 * 字幕翻译风格的设置键与解析逻辑。
 *
 * 批量提示词模板与拼装已下放到各引擎网关自持
 * （见 src/backend/infrastructure/translate/subtitleBatchPrompt.ts），
 * 这里只保留风格默认值、设置键与风格签名，供设置与缓存键使用。
 */
import { TranslationMode } from '@/common/types/TranslationResult';

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
