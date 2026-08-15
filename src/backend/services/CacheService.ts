import { injectable } from 'inversify';

import { SrtSentence } from '@/common/types/SentenceC';
import { VideoLearningClipStatusVO } from '@/common/types/vo/VideoLearningClipStatusVO';

/**
 * 缓存命名空间与对应值类型。
 */
export type CacheType = {
    'cache:srt': SrtSentence;
    'cache:clip-status': VideoLearningClipStatusVO;
};

/**
 * CacheService 的业务契约。
 */
export default interface CacheService {
    /**
     * 读取缓存值，并在值已过期时立即删除。
     *
     * @param type 缓存命名空间。
     * @param key 业务键。
     * @returns 缓存值；不存在或已过期时返回 `null`。
     */
    get<T extends keyof CacheType>(type: T, key: string): CacheType[T] | null;

    /**
     * 写入缓存值。
     *
     * @param type 缓存命名空间。
     * @param key 业务键。
     * @param value 缓存值。
     * @param ttl 可选有效期，单位为毫秒；不传时不会自动过期。
     */
    set<T extends keyof CacheType>(type: T, key: string, value: CacheType[T], ttl?: number): void;

    /**
     * 删除指定缓存值。
     *
     * @param type 缓存命名空间。
     * @param key 业务键。
     */
    delete<T extends keyof CacheType>(type: T, key: string): void;

    /**
     * 清空当前进程中的全部缓存。
     */
    clear(): void;
}



/**
 * 提供进程内的短期 JSON 缓存。
 */
@injectable()
export class CacheServiceImpl implements CacheService {
    private cache = new Map<string, { value: string; expires?: number }>();

    /**
     * 读取缓存值，并在值已过期时立即删除。
     *
     * @param type 缓存命名空间。
     * @param key 业务键。
     * @returns 缓存值；不存在或已过期时返回 `null`。
     */
    public get<T extends keyof CacheType>(type: T, key: string): CacheType[T] | null {
        const mapKey = this.getMapKey(type, key);
        const item = this.cache.get(mapKey);
        if (!item) {
            return null;
        }

        if (item.expires && Date.now() > item.expires) {
            this.cache.delete(mapKey);
            return null;
        }

        return JSON.parse(item.value) as CacheType[T];
    }

    /**
     * 写入缓存值。
     *
     * @param type 缓存命名空间。
     * @param key 业务键。
     * @param value 缓存值。
     * @param ttl 可选有效期，单位为毫秒；不传时不会自动过期。
     */
    public set<T extends keyof CacheType>(type: T, key: string, value: CacheType[T], ttl?: number): void {
        const expires = ttl ? Date.now() + ttl : undefined;
        this.cache.set(this.getMapKey(type, key), {
            value: JSON.stringify(value),
            expires,
        });
    }

    /**
     * 删除指定缓存值。
     *
     * @param type 缓存命名空间。
     * @param key 业务键。
     */
    public delete<T extends keyof CacheType>(type: T, key: string): void {
        this.cache.delete(this.getMapKey(type, key));
    }

    /**
     * 清空当前进程中的全部缓存。
     */
    public clear(): void {
        this.cache.clear();
    }

    /**
     * 生成内部 Map 使用的唯一键。
     *
     * @param type 缓存命名空间。
     * @param key 业务键。
     * @returns 拼接后的内部键。
     */
    private getMapKey(type: string, key: string): string {
        return `${type}::=::${key}`;
    }
}
