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
     * @param query
     */
    public static async updateValue(query: KeyValueEntity): Promise<void> {
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
    public static async queryValue(
        query: KeyValueEntity
    ): Promise<KeyValueEntity> {
        const progressEntities: KeyValueEntity[] = await this.cache.loadCache(
            query
        );
        if (progressEntities.length === 0) {
            return query;
        }
        if (progressEntities.length > 1) {
            log.warn('value num bigger than one');
        }
        return progressEntities[0];
    }
}

export default ProgressCache;
