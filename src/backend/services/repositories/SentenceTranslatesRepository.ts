import { InsertSentenceTranslate, SentenceTranslate } from '@/backend/infrastructure/db/tables/sentenceTranslates';

export type SentenceTranslatesUpsertParams = Pick<InsertSentenceTranslate, 'sentence' | 'translate' | 'mode'> & Partial<Pick<InsertSentenceTranslate, 'updated_at'>>;

/**
 * 句级翻译结果的持久化读写。
 */
export default interface SentenceTranslatesRepository {
    /**
     * 按存储键集合与缓存模式批量查询已有译文。
     *
     * @param sentences 内容派生的存储键（单句原文或带前后文的哈希键），非字幕定位键。
     * @param mode 持久化缓存模式。
     * @returns 命中的翻译记录；调用方负责过滤空译文。
     */
    findBySentencesAndMode(sentences: string[], mode: string): Promise<SentenceTranslate[]>;
    /**
     * 按 (存储键, 模式) 幂等写入单条译文。
     *
     * @param params 存储键、译文、模式与可选更新时间。
     */
    upsert(params: SentenceTranslatesUpsertParams): Promise<void>;
    /**
     * 批量幂等写入译文。
     *
     * @param params 待写入条目列表。
     */
    upsertMany(params: SentenceTranslatesUpsertParams[]): Promise<void>;
}

