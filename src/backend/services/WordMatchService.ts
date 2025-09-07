import { Word } from '@/backend/db/tables/words';

export interface WordMatchService {
    matchWordsInText(text: string): Promise<MatchedWord[]>;
    getVocabularyWords(): Promise<Word[]>;
}

export interface MatchedWord {
    original: string;      // 原始形态（如复数、时态等）
    normalized: string;    // 标准化形态
    stem: string;         // 词干形态
    databaseWord?: Word;   // 数据库中匹配的单词
}