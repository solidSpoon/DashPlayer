import ProgressEntity from '../ServerLib/entity/ProgressEntity';
import ProgressCache from '../ServerLib/ProgressCache';

export interface ProgressParam {
    fileName: string;
    progress: number;
    /**
     * 文件位置
     */
    filePath: string | undefined;

    /**
     * 字幕文件位置
     */
    subtitlePath: string | undefined;
}

/**
 * 更新播放进度
 * @param fileName
 * @param progress
 */
export async function updateProgress(progress: ProgressParam): Promise<void> {
    const progressEntity = new ProgressEntity(progress.fileName);
    progressEntity.filePath = progress.filePath;
    progressEntity.subtitlePath = progress.subtitlePath;
    progressEntity.progress = progress.progress;
    await ProgressCache.updateProgress(progressEntity);
}

/**
 * 查询播放进度
 * @param fileName
 */
export async function queryProgress(fileName: string): Promise<number> {
    const progressEntity = new ProgressEntity(fileName);
    const result = await ProgressCache.queryProcess(progressEntity);
    return result.progress ?? 0;
}
