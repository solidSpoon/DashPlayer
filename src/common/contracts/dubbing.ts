/**
 * 配音功能契约类型。
 *
 * `videoKey` 为字幕内容哈希（srtHash）；一个视频的全部配音集中在
 * 媒体库 `dubbing/<videoKey>/` 目录下，删除该目录即清空该视频的配音。
 */

/**
 * 单遍配音录音。
 */
export interface DubbingTake {
    /** 录音遍 ID。 */
    id: string;
    /** 视频目录内的文件名。 */
    fileName: string;
    /** 掐头去尾后的时长，单位秒。 */
    durationSec: number;
    /** 创建时间，epoch 毫秒。 */
    createdAt: number;
    /** 录音文件绝对路径；由后端读取清单时填充，供前端回放，不参与持久化。 */
    filePath?: string;
}

/**
 * 保存录音后返回给前端的录音信息。
 */
export interface DubbingTakeVO extends DubbingTake {
    /** 录音文件绝对路径，供前端回放。 */
    filePath: string;
}

/**
 * 一句话的配音记录。
 */
export interface DubbingSentenceRecord {
    /** 字幕句序号。 */
    index: number;
    /** 该句的全部录音遍，按创建时间升序。 */
    takes: DubbingTake[];
    /** 当前生效的录音遍 ID；默认为最新一遍。 */
    activeTakeId: string;
}

/**
 * 一个视频的配音清单。
 */
export interface DubbingManifest {
    /** 字幕内容哈希。 */
    videoKey: string;
    /** 已配音句子，key 为句序号。 */
    sentences: Record<string, DubbingSentenceRecord>;
}

/**
 * 配音导出进度推送。
 */
export interface DubbingExportStatus {
    /** 字幕内容哈希。 */
    videoKey: string;
    /** 导出任务状态。 */
    status: 'running' | 'completed' | 'failed';
    /** 进度，范围 0~100。 */
    progress: number;
    /** 失败时的原因说明。 */
    message?: string;
    /** 导出产物绝对路径。 */
    outputPath?: string;
}
