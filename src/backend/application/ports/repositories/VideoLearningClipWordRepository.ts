import { InsertVideoLearningClipWord } from '@/backend/infrastructure/db/tables/videoLearningClipWord';

export default interface VideoLearningClipWordRepository {
    findClipKeysByWord(word: string): Promise<string[]>;
    getWordsMapByClipKeys(keys: string[]): Promise<Map<string, string[]>>;
    insertManyIgnoreDuplicates(values: InsertVideoLearningClipWord[]): Promise<void>;
    deleteAll(): Promise<void>;
    countGroupedByWord(): Promise<Record<string, number>>;
}

