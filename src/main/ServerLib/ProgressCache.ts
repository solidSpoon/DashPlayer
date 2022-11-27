import ProgressEntity from "./entity/ProgressEntity";
import BaseCache from "./basecache/BaseCache";
import CacheConfig from "./basecache/CacheConfig";

class ProgressCache {
    private static cache: BaseCache<ProgressEntity>;
    static {
        this.cache = new BaseCache<ProgressEntity>(CacheConfig.progressConfig);
    }

    /**
     * 更新视频进度
     * @param progress
     */
    public static async updateProgress(progress: ProgressEntity): Promise<void> {
        const updateNum = await this.cache.insertOrUpdate(progress);
        if (updateNum === 1) {
            return;
        }
        console.log("update progress multi line:", updateNum);
        await this.cache.delete(progress);
        await this.cache.insertOrUpdate(progress);
    }

    /**
     * 查询视频进度
     * @param progress
     */
    public static async queryProcess(progress: ProgressEntity): Promise<ProgressEntity> {
        const progressEntities: ProgressEntity[] = await this.cache.loadCache(progress);
        if (progressEntities.length === 0) {
            progress.progress = 0;
            return progress;
        } else {
            if (progressEntities.length > 1) {
                console.log("progress length bigger than one")
            }
            return progressEntities[0];
        }
    }
}

export default ProgressCache;