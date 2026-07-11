import { Sentence } from '@/common/types/SentenceC';

export type SubtitleBatchParseSentence = Pick<Sentence, 'fileHash' | 'translationKey'>;

export type SubtitleBatchParseItem = {
    key: string;
    fileHash: string;
    translation: string;
};

const sanitizeString = (value?: unknown): string | undefined => {
    if (typeof value !== 'string') {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
};

const extractJsonText = (text: string): string | null => {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced?.[1] ?? text;
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start < 0 || end < start) {
        return null;
    }
    return candidate.slice(start, end + 1);
};

export const parseOpenAIBatchTextResult = (
    text: string,
    windowSentences: SubtitleBatchParseSentence[]
): SubtitleBatchParseItem[] => {
    const jsonText = extractJsonText(text);
    if (!jsonText) {
        return [];
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(jsonText);
    } catch {
        return [];
    }

    if (!parsed || typeof parsed !== 'object') {
        return [];
    }
    const items = (parsed as { items?: unknown }).items;
    if (!Array.isArray(items)) {
        return [];
    }

    const sentenceMap = new Map(windowSentences.map((sentence) => [sentence.translationKey, sentence]));
    return items
        .map((item) => {
            if (!item || typeof item !== 'object') {
                return null;
            }
            const record = item as Record<string, unknown>;
            const key = sanitizeString(record.key);
            if (!key) {
                return null;
            }
            const sentence = sentenceMap.get(key);
            const translation = sanitizeString(record.translation);
            if (!sentence || !translation) {
                return null;
            }
            return {
                key,
                fileHash: sentence.fileHash,
                translation
            };
        })
        .filter((item): item is SubtitleBatchParseItem => item !== null);
};
