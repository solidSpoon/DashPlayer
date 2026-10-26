import type { MobileRecentItem, MobileWatchDetail } from '@/common/contracts/mobile-web';
import type { OpenAIDictionaryResult } from '@/common/types/DictionaryResult';

/**
 * 请求手机页 JSON 接口。
 *
 * @param path 接口路径。
 * @param init fetch 选项。
 * @returns 解析后的 JSON。
 * @throws 非 2xx 或响应不是合法 JSON 时抛出。
 */
const fetchJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(path, init);
    let payload: unknown = null;
    try {
        payload = await response.json();
    } catch {
        payload = null;
    }
    if (!response.ok) {
        const message = payload && typeof payload === 'object' && 'error' in payload
            ? String((payload as { error: unknown }).error)
            : `HTTP ${response.status}`;
        throw new Error(message);
    }
    return payload as T;
};

/**
 * 手机页调用的后端接口。
 */
export const mobileApi = {
    /**
     * 查询最近播放列表。
     *
     * @returns 最近播放条目。
     */
    listRecent: async (): Promise<MobileRecentItem[]> => {
        const payload = await fetchJson<{ items: MobileRecentItem[] }>('/api/recent');
        return payload.items;
    },

    /**
     * 查询播放详情与字幕。
     *
     * @param id 观看记录 ID。
     * @returns 播放详情。
     */
    getWatchDetail: (id: string): Promise<MobileWatchDetail> => {
        return fetchJson<MobileWatchDetail>(`/api/videos/${encodeURIComponent(id)}`);
    },

    /**
     * 查询单词释义。
     *
     * @param word 查询词。
     * @returns 词典结果；没有释义时为 null。
     */
    lookupWord: async (word: string): Promise<OpenAIDictionaryResult | null> => {
        const payload = await fetchJson<{ result: OpenAIDictionaryResult | null }>(
            `/api/dictionary?word=${encodeURIComponent(word)}`,
        );
        return payload.result;
    },

    /**
     * 批量翻译字幕行。
     *
     * @param texts 待翻译的字幕文本。
     * @returns 与入参顺序一致的译文。
     */
    translateTexts: async (texts: string[]): Promise<string[]> => {
        const payload = await fetchJson<{ translations: string[] }>('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texts }),
        });
        return payload.translations;
    },

    /**
     * 写回播放进度。
     *
     * @param id 观看记录 ID。
     * @param position 播放位置，单位秒。
     * @param keepalive 页面即将隐藏时是否用 keepalive 发送。
     */
    saveProgress: (id: string, position: number, keepalive: boolean): Promise<{ ok: boolean }> => {
        return fetchJson<{ ok: boolean }>(`/api/videos/${encodeURIComponent(id)}/progress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ position }),
            keepalive,
        });
    },
};
