export type ClipVocabularyEntry = {
    base: string;
    forms: string[];
};

export type VideoLearningClipVO = {
    // 基础标识信息
    key: string;
    sourceType: 'oss' | 'local';
    
    // 视频信息
    videoName: string;
    videoPath: string;
    
    // 时间信息
    createdAt: number;
    
    // 字幕内容
    clipContent: Array<{
        index: number;
        start: number;
        end: number;
        contentEn: string;
        contentZh: string;
        isClip: boolean;
    }>;
    vocabulary: ClipVocabularyEntry[];
};

export type VideoLearningClipPage = {
    items: VideoLearningClipVO[];
    total: number;
    page: number;
    pageSize: number;
};
