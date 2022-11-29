import ProgressEntity from '../ServerLib/entity/ProgressEntity';
import ProgressCache from '../ServerLib/ProgressCache';

/**
 * 更新播放进度
 * @param fileName
 * @param progress
 */
export async function updateProgress(
    fileName: string,
    progress: number
): Promise<void> {
    const progressEntity = new ProgressEntity(fileName);
    progressEntity.progress = progress;
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
