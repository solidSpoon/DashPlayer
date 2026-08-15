import { SimpleClipQuery } from '@/common/api/dto';
import { ClipSrtLine } from '@/common/types/clipMeta';
import { ClipVocabularyEntry, VideoLearningClipPage } from '@/common/types/vo/VideoLearningClipVO';
import { GlobalVideoLearningClipQueueStatusVO, VideoLearningClipStatusVO } from '@/common/types/vo/VideoLearningClipStatusVO';

/**
 * VideoLearningService
 */
export interface VideoLearningService {

    /**
     * 自动根据单词表裁切视频片段
     * @param videoPath - 视频文件路径
     * @param srtKey - 字幕文件键
     * @returns Promise<void>
     */
    autoClip(videoPath: string, srtKey: string, srtPath?: string): Promise<void>;

    /**
     * 删除学习片段
     * @param key - 片段键
     * @returns Promise<void>
     */
    deleteLearningClip(key: string): Promise<void>;


    /**
     * 搜索学习片段
     * @param query - 查询参数
     * @returns Promise<VideoLearningClipPage>
     */
    search(query: SimpleClipQuery): Promise<VideoLearningClipPage>;

    /**
     * 为当前片段解析词汇高亮所需的词形映射。
     *
     * @param lines 当前片段字幕行。
     * @param words 片段关联的基础词列表。
     * @returns 词汇映射结果。
     */
    resolveClipVocabulary(lines: ClipSrtLine[], words: string[]): Promise<ClipVocabularyEntry[]>;



    /**
     * 从 OSS 同步数据
     * @returns Promise<void>
     */
    syncFromOss(): Promise<void>;

    /**
     * 统计每个单词对应的视频片段数量
     */
    countClipsGroupedByWord(): Promise<Record<string, number>>;

    /**
     * 检测视频裁切状态
     * @param videoPath - 视频文件路径
     * @param srtKey - 字幕文件键
     * @returns Promise<{status: 'pending' | 'in_progress' | 'completed', pendingCount?: number, inProgressCount?: number, completedCount?: number}>
     */
    detectClipStatus(videoPath: string, srtKey: string, srtPath?: string): Promise<VideoLearningClipStatusVO>;

    /**
     * 获取全局自动裁切队列状态。
     * @returns 当前全局自动裁切队列快照
     */
    getGlobalClipQueueStatus(): Promise<GlobalVideoLearningClipQueueStatusVO>;

    /**
     * 清空全局队列中尚未开始的自动裁切任务。
     *
     * 已经开始执行的任务会继续完成，不计入返回数量。
     *
     * @returns 被清理的等待任务数量
     */
    cancelAllAutoClipTasks(): Promise<number>;

    /**
     * 词库更新后清理分析缓存
     */
    invalidateClipAnalysisCache(): void;
}
