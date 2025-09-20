import { ClipQuery, SimpleClipQuery } from '@/common/api/dto';
import { VideoLearningClipVO } from '@/common/types/vo/VideoLearningClipVO';
import {VideoLearningClipStatusVO} from "@/common/types/vo/VideoLearningClipStatusVO";

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
     * 取消添加学习片段
     * @param srtKey - 字幕文件键
     * @param indexInSrt - 字幕索引
     * @returns Promise<void>
     */
    cancelAddLearningClip(srtKey: string, indexInSrt: number): Promise<void>;

    /**
     * 删除学习片段
     * @param key - 片段键
     * @returns Promise<void>
     */
    deleteLearningClip(key: string): Promise<void>;


    /**
     * 搜索学习片段
     * @param query - 查询参数
     * @returns Promise<VideoLearningClipVO[]>
     */
    search(query: SimpleClipQuery): Promise<VideoLearningClipVO[]>;



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
}
