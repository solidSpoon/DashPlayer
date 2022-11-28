import BaseCacheEntity from '../basecache/BaseCacheEntity';

/**
 * 翻译缓存实体类
 */
export default class TransCacheEntity extends BaseCacheEntity<TransCacheEntity> {
    /**
     * 原文
     */
    original: string;

    /**
     * 译文
     */
    translate: string | undefined;

    /**
     * 构造方法
     * @param original 原文
     */
    constructor(original: string) {
        super(original);
        this.original = original.trim();
    }
}
