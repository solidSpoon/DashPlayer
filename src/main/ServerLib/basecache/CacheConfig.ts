export interface BaseCacheConfig {
    filename: string,
}

/**
 * 数据库配置文件
 */
export default class CacheConfig {
    /**
     * 缓存翻译结果的数据库
     */
    public static transConfig: BaseCacheConfig = {
        filename: './db/sentence.db'
    }
    /**
     * 缓存观看进度的数据库
     */
    public static progressConfig: BaseCacheConfig = {
        filename: './db/progress.db'
    }
}