export type VideoLearningClipStatus = 'pending' | 'in_progress' | 'completed' | 'analyzing';

export interface VideoLearningClipStatusVO {
    status: VideoLearningClipStatus;
    pendingCount?: number;
    inProgressCount?: number;
    completedCount?: number;
    analyzingProgress?: number; // 0-100 分析进度
    seq?: number; // 状态序号，单调递增
}
