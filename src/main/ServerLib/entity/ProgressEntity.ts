import BaseCacheEntity from '../basecache/BaseCacheEntity';

class ProgressEntity extends BaseCacheEntity<ProgressEntity> {
    /**
     * 文件名
     */
    fileName: string;

    /**
     * 文件位置
     */
    filePath: string | undefined;

    /**
     * 字幕文件位置
     */
    subtitlePath: string | undefined;

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
