import log from 'electron-log';
import ProgressEntity from './entity/ProgressEntity';
import BaseCache from './basecache/BaseCache';
import CacheConfig from './basecache/CacheConfig';

class ProgressCache {
    private static cache: BaseCache<ProgressEntity>;

    static {
        this.cache = new BaseCache<ProgressEntity>(CacheConfig.progressConfig);
    }

    /**
     * 更新视频进度
     * @param progress
     */
    public static async updateProgress(
        progress: ProgressEntity
    ): Promise<void> {
        const updateNum = await this.cache.insertOrUpdate(progress);
        if (updateNum === 1) {
            return;
        }
        log.warn('update progress multi line:', updateNum);
        await this.cache.delete(progress);
        await this.cache.insertOrUpdate(progress);
    }

    /**
     * 查询视频进度
     * @param progress
     */
    public static async queryProcess(
        progress: ProgressEntity
    ): Promise<ProgressEntity> {
        const progressEntities: ProgressEntity[] = await this.cache.loadCache(
            progress
        );
        if (progressEntities.length === 0) {
            progress.progress = 0;
            return progress;
        }
        if (progressEntities.length > 1) {
            log.warn('progress length bigger than one');
        }
        return progressEntities[0];
    }

    /**
     * 删除一个月前的缓存
     */
    public static async clearCache(): Promise<void> {
        await this.cache.clearCache();
    }

    static async queryRecentPlay(size: number): Promise<ProgressEntity[]> {
        return this.cache.queryRecentPlay(size);
    }
}

export default ProgressCache;
