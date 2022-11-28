import BaseCacheEntity from '../basecache/BaseCacheEntity';

class ProgressEntity extends BaseCacheEntity<ProgressEntity> {
    /**
     * 文件名
     */
    fileName: string;

    /**
     * 观看进度
     */
    progress: number | undefined;

    /**
     * 构造方法
     * @param fileName 文件名
     */
    constructor(fileName: string) {
        super(fileName);
        this.fileName = fileName.trim();
    }
}

export default ProgressEntity;
