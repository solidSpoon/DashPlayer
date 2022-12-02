import log from 'electron-log';
import BaseCache from './basecache/BaseCache';
import CacheConfig from './basecache/CacheConfig';
import KeyValueEntity from './entity/KeyValueEntity';

class ProgressCache {
    private static cache: BaseCache<KeyValueEntity>;

    static {
        this.cache = new BaseCache<KeyValueEntity>(CacheConfig.keyValueConfig);
    }

    /**
     * 更新值
     * @param key
     * @param value
     */
    public static async updateValue(key: string, value: string): Promise<void> {
        const query = new KeyValueEntity(key);
        query.value = value;
        const updateNum = await this.cache.insertOrUpdate(query);
        if (updateNum === 1) {
            return;
        }
        log.warn('update progress multi line:', updateNum);
        await this.cache.delete(query);
        await this.cache.insertOrUpdate(query);
    }

    /**
     * 查询值
     * @param query
     */
    public static async queryValue(key: string): Promise<string | undefined> {
        const query = new KeyValueEntity(key);
        const progressEntities: KeyValueEntity[] = await this.cache.loadCache(
            query
        );
        if (progressEntities.length === 0) {
            return query.value;
        }
        if (progressEntities.length > 1) {
            log.warn('value num bigger than one');
        }
        return progressEntities[0].value;
    }
}

export default ProgressCache;
