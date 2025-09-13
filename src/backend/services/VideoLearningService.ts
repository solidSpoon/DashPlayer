import { ClipQuery } from '@/common/api/dto';
import { ClipMeta, OssBaseMeta } from '@/common/types/clipMeta';

/**
 * VideoLearningService
 */
export interface VideoLearningService {

    taskInfo(): number;

    /**
     * 自动根据单词表裁切视频片段
     * @param videoPath - 视频文件路径
     * @param srtKey - 字幕文件键
     * @returns Promise<void>
     */
    autoClip(videoPath: string, srtKey: string): Promise<void>;

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
     * @returns Promise<(OssBaseMeta & ClipMeta)[]>
     */
    search(query: ClipQuery & { matchedWord?: string }): Promise<(OssBaseMeta & ClipMeta)[]>;

    /**
     * 检查片段是否存在
     * @param srtKey - 字幕文件键
     * @param linesInSrt - 字幕索引数组
     * @returns Promise<Map<number, boolean>>
     */
    exists(srtKey: string, linesInSrt: number[]): Promise<Map<number, boolean>>;

    /**
     * 根据单词搜索学习片段
     * @param words - 单词数组
     * @returns Promise<(OssBaseMeta & ClipMeta)[]>
     */
    searchByWords(words: string[]): Promise<(OssBaseMeta & ClipMeta)[]>;

    /**
     * 从 OSS 同步数据
     * @returns Promise<void>
     */
    syncFromOss(): Promise<void>;
}