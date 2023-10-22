import fs from 'fs';
import ProgressEntity from '../ServerLib/entity/ProgressEntity';
import ProgressCache from '../ServerLib/ProgressCache';

export interface ProgressParam {
    fileName: string;
    /**
     * 总时长
     */
    total: number;
    /**
     * 当前进度
     */
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
    progressEntity.total = progress.total;
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

/**
 * 最近播放
 */
export async function queryRecentPlay(size: number): Promise<ProgressParam[]> {
    const result = await ProgressCache.queryRecentPlay(size);
    return result
        .filter((e) => e.filePath)
        .filter((e) => fs.existsSync(e.filePath ?? ''))
        .map((item) => {
            return {
                fileName: item.fileName,
                filePath: item.filePath,
                subtitlePath: item.subtitlePath,
                progress: item.progress ?? 0,
                total: item.total ?? 0,
            };
        });
}
