import { ClipSrtLine } from '@/common/types/clipMeta';
import { ClipVocabularyEntry } from '@/common/types/vo/VideoLearningClipVO';

/**
 * 视频学习页使用的片段视图模型。
 */
export interface VideoClip {
    /** 片段唯一键。 */
    key: string;
    /** 片段来源类型。 */
    sourceType: 'oss' | 'local';
    /** 原视频名称。 */
    videoName: string;
    /** 原视频路径。 */
    videoPath: string;
    /** 片段创建时间戳。 */
    createdAt: number;
    /** 片段对应的字幕行。 */
    clipContent: ClipSrtLine[];
    /** 片段关联的词汇信息。 */
    vocabulary: ClipVocabularyEntry[];
}
