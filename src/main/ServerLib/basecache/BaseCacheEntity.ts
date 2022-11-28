import crypto from 'crypto';
import log from 'electron-log';

export default abstract class BaseCacheEntity<T> {
    /**
     * 唯一标识
     */
    readonly hash: string;

    /**
     * 更新时间
     */
    readonly updateTime: number;

    /**
     * 构造方法
     * @param keyProperty 可以唯一标识的属性
     * @protected
     */
    protected constructor(keyProperty: string) {
        this.updateTime = Date.now();
        this.hash = this.calcHash(keyProperty);
    }

    /**
     * 计算 hash
     * @param str 原字符串
     * @return hash 值
     * @private
     */
    private calcHash = (str: string): string => {
        try {
            return crypto.createHash('md5').update(str.trim()).digest('hex');
        } catch (e) {
            log.error(`calc hash failed, str: ${str}`);
            throw e;
        }
    };
}
