import log from 'electron-log';
import TransCacheEntity from './entity/TransCacheEntity';
import BaseCache from './basecache/BaseCache';
import CacheConfig from './basecache/CacheConfig';

export default class TranslateCache {
    private static cache: BaseCache<TransCacheEntity>;

    static {
        this.cache = new BaseCache<TransCacheEntity>(CacheConfig.transConfig);
    }

    public static async insertBatch(
        arr: TransCacheEntity[]
    ): Promise<TransCacheEntity[]> {
        if (arr === undefined || arr.length === 0) {
            return [];
        }
        return this.cache.insertBatch(arr);
    }

    public static async loadCache(
        entities: TransCacheEntity[]
    ): Promise<TransCacheEntity[]> {
        if (entities === undefined || entities.length === 0) {
            return [];
        }
        const queryResult: TransCacheEntity[] = await this.cache.loadBatch(
            entities
        );
        const repeat: TransCacheEntity[] = this.findRepeat(queryResult);
        if (repeat.length === 0) {
            return queryResult;
        }
        log.warn('translate cache find repeat', repeat);
        await this.cache.deleteBatch(repeat);
        await this.cache.insertBatch(repeat);
        return queryResult;
    }

    private static findRepeat(
        queryResult: TransCacheEntity[]
    ): TransCacheEntity[] {
        const map = new Map<string, number>();
        queryResult.forEach((item) =>
            map.set(item.hash, (map.get(item.hash) ?? 0) + 1)
        );
        const toRemoveHash: string[] = [];
        map.forEach((value, key) => {
            if (value > 1) {
                log.warn(
                    `trans cache find repeat key: ${key}, value: ${value}`
                );
                toRemoveHash.push(key);
            }
        });

        const result: TransCacheEntity[] = [];
        toRemoveHash.forEach((hash) => {
            const find = queryResult.find((item) => item.hash === hash);
            if (find !== undefined) {
                result.push(find);
            }
        });
        return result;
    }
}
