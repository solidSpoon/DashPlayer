/** 单个单词的片段统计：数量与最近一次被添加视频的时间。 */
export interface WordClipStats {
    /** 该单词关联的视频片段数量。 */
    count: number;
    /** 最近一次被添加视频的时间（ISO/UTC 字符串）；无关联时为空字符串。 */
    lastAddedAt: string;
}

export default interface VideoLearningClipWordRepository {
    findClipKeysByWord(word: string): Promise<string[]>;
    getWordsMapByClipKeys(keys: string[]): Promise<Map<string, string[]>>;
    /**
     * 按单词聚合片段统计。
     *
     * @returns 单词到片段数量与最近添加视频时间的映射。
     */
    statsGroupedByWord(): Promise<Record<string, WordClipStats>>;
    /**
     * 将某单词的全部片段关联迁移到新单词。
     *
     * 行为说明：
     * - 与新单词已存在的同一片段关联会被去重，避免触碰唯一索引。
     *
     * @param oldWord 原单词。
     * @param newWord 新单词。
     */
    renameWord(oldWord: string, newWord: string): Promise<void>;
    /**
     * 删除某单词的全部片段关联。
     *
     * @param word 单词。
     */
    deleteByWord(word: string): Promise<void>;
}
