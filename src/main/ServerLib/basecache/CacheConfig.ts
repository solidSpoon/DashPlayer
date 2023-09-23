import { app } from 'electron';

export interface BaseCacheConfig {
    filename: string;
}
export const concatPath = (...paths: string[]) => {
    const sep = process.platform === 'win32' ? '\\' : '/';
    return paths.join(sep);
};

export const BASE_PATH = concatPath(app.getPath('userData'), 'useradd');
/**
 * 数据库配置文件
 */
export default class CacheConfig {
    /**
     * 缓存翻译结果的数据库
     */
    public static transConfig: BaseCacheConfig = {
        // filename: `${BASE_PATH}/db/sentence.db`,
        filename: concatPath(BASE_PATH, 'db', 'sentence.db'),
    };

    /**
     * 缓存单词的数据库
     */
    public static wordConfig: BaseCacheConfig = {
        // filename: `${BASE_PATH}/db/word.db`,
        filename: concatPath(BASE_PATH, 'db', 'word.db'),
    };

    /**
     * 缓存观看进度的数据库
     */
    public static progressConfig: BaseCacheConfig = {
        // filename: `${BASE_PATH}/db/progress.db`,
        filename: concatPath(BASE_PATH, 'db', 'progress.db'),
    };

    /**
     * 键值数据库
     */
    public static keyValueConfig: BaseCacheConfig = {
        // filename: `${BASE_PATH}/db/keyValue.db`,
        filename: concatPath(BASE_PATH, 'db', 'keyValue.db'),
    };
}
