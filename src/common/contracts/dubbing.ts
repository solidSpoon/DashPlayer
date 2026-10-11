/**
 * 配音功能契约类型。
 *
 * `videoKey` 为字幕内容哈希（srtHash）；一个视频的全部配音集中在
 * 媒体库 `dubbing/<videoKey>/` 目录下，删除该目录即清空该视频的配音。
 */

/**
 * 一句配音的录音。
 */
export interface DubbingTake {
    /** 录音 ID。 */
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
 * 一句话的配音记录。每句只留一份录音，重录即覆盖。
 */
export interface DubbingSentenceRecord {
    /** 字幕句序号。 */
    index: number;
    /** 该句当前的录音。 */
    take: DubbingTake;
}

/**
 * 一个视频的配音清单。
 */
export interface DubbingManifest {
    /** 字幕内容哈希。 */
    videoKey: string;
    /** 录音时记录的来源视频绝对路径；导出页据此定位视频，缺失表示无法导出。 */
    videoPath?: string;
    /** 录音时绑定的字幕文件绝对路径；导出时据此重新推导每句时间区间，缺失表示无法导出。 */
    subtitlePath?: string | null;
    /** 已配音句子，key 为句序号。 */
    sentences: Record<string, DubbingSentenceRecord>;
}

/**
 * 导出页展示的一条配音记录。
 *
 * 仅包含视频文件仍存在的条目；视频被删或移走的不会出现在列表里。
 */
export interface DubbingLibraryEntry {
    /** 字幕内容哈希，配音目录键。 */
    videoKey: string;
    /** 视频文件绝对路径。 */
    videoPath: string;
    /** 视频文件名，用于展示。 */
    videoName: string;
    /** 已配音句数。 */
    dubbedSentenceCount: number;
    /** 最近一次录音时间，epoch 毫秒。 */
    updatedAt: number;
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
