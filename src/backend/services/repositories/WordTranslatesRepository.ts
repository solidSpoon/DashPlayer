import { WordTranslate } from '@/backend/infrastructure/db/tables/wordTranslates';

export default interface WordTranslatesRepository {
    findOne(word: string, provider: string): Promise<WordTranslate | null>;
    upsert(word: string, provider: string, translate: string, updatedAt?: string): Promise<void>;
    /**
     * 删除指定词典 provider 下的全部缓存。
     *
     * @param provider 词典缓存 provider，精确匹配。
     * @returns 实际删除的记录数。
     */
    deleteByProvider(provider: string): Promise<number>;
}

