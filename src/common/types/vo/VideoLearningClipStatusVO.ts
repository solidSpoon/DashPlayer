export type VideoLearningClipStatus = 'pending' | 'in_progress' | 'completed';

export interface VideoLearningClipStatusVO {
    status: VideoLearningClipStatus;
    pendingCount?: number;
    inProgressCount?: number;
    completedCount?: number;
}