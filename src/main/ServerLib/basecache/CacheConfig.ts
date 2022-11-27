import { app } from "electron";

export interface BaseCacheConfig {
    filename: string,
}

/**
 * 数据库配置文件
 */
export default class CacheConfig {
    static base = app.getPath("userData");
    /**
     * 缓存翻译结果的数据库
     */
    public static transConfig: BaseCacheConfig = {
        filename: `${this.base}/db/sentence.db`
    };
    /**
     * 缓存观看进度的数据库
     */
    public static progressConfig: BaseCacheConfig = {
        filename: `${this.base}/db/progress.db`
    };
}
