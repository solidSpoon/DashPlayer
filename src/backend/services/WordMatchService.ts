import { Word } from '@/backend/infrastructure/db/tables/words';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import WordsRepository from '@/backend/services/repositories/WordsRepository';
import {
    CompromiseVocabularyMatcher,
    VocabularyEntry,
    VocabularyMatcher,
} from '@/backend/utils/language/VocabularyMatcher';

export interface WordMatchService {
    matchWordsInText(text: string): Promise<MatchedWord[]>;
    matchWordsInTexts(texts: string[]): Promise<MatchedWord[][]>;
    getVocabularyWords(): Promise<Word[]>;
    /**
     * 获取当前词表版本，用于区分不同词表快照生成的分析结果。
     */
    getVocabularyRevision(): number;
    invalidateVocabularyCache(): void;
}

export interface MatchedWord {
    original: string;      // 原始形态（如复数、时态等）
    normalized: string;    // 标准化形态
    databaseWord?: Word;   // 数据库中匹配的单词
}


@injectable()
export class WordMatchServiceImpl implements WordMatchService {

    private vocabularyWordsCache: Word[] | null = null;
    private vocabularyMatcherCache: VocabularyMatcher<Word> | null = null;
    /** 词表缓存版本，每次词表失效时递增。 */
    private vocabularyRevision = 0;

    @inject(TYPES.WordsRepository)
    private wordsRepository!: WordsRepository;

    async matchWordsInText(text: string): Promise<MatchedWord[]> {
        const results = await this.matchWordsInTexts([text]);
        return results[0] || [];
    }

    async matchWordsInTexts(texts: string[]): Promise<MatchedWord[][]> {
        if (!Array.isArray(texts) || texts.length === 0) {
            return [];
        }

        const vocabularyWords = await this.getVocabularyWords();
        if (!vocabularyWords || vocabularyWords.length === 0) {
            return texts.map(() => []);
        }

        const vocabularyMatcher = this.getVocabularyMatcher(vocabularyWords);

        return texts.map(text => this.matchSingleText(text, vocabularyMatcher));
    }

    /**
     * 获取词表匹配器缓存。
     *
     * @param vocabularyWords 当前词表快照。
     * @returns 已编译的词表匹配器。
     */
    private getVocabularyMatcher(vocabularyWords: Word[]): VocabularyMatcher<Word> {
        if (this.vocabularyMatcherCache) {
            return this.vocabularyMatcherCache;
        }

        const entries: VocabularyEntry<Word>[] = vocabularyWords.map((word) => ({
            text: word.word,
            payload: word,
        }));
        this.vocabularyMatcherCache = new CompromiseVocabularyMatcher(entries);
        return this.vocabularyMatcherCache;
    }

    /**
     * 匹配单段文本中的词表词条。
     *
     * 行为说明：
     * - 统一交给词表匹配器处理。
     * - 单词词条与词组词条会自动走各自的匹配策略。
     *
     * @param text 待匹配文本。
     * @param vocabularyMatcher 已编译的词表匹配器。
     * @returns 命中的词条列表。
     */
    private matchSingleText(text: string, vocabularyMatcher: VocabularyMatcher<Word>): MatchedWord[] {
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            return [];
        }

        return vocabularyMatcher.match(text).map((match) => ({
            original: match.original,
            normalized: match.normalized,
            databaseWord: match.payload,
        }));
    }

    async getVocabularyWords(): Promise<Word[]> {
        if (this.vocabularyWordsCache) {
            return this.vocabularyWordsCache;
        }

        this.vocabularyWordsCache = await this.wordsRepository.getAll();
        return this.vocabularyWordsCache;
    }

    /**
     * 获取当前词表版本。
     *
     * @returns 当前进程内词表缓存版本。
     */
    getVocabularyRevision(): number {
        return this.vocabularyRevision;
    }

    /**
     * 清除词表缓存并使基于旧词表的分析结果失效。
     */
    invalidateVocabularyCache(): void {
        this.vocabularyWordsCache = null;
        this.vocabularyMatcherCache = null;
        this.vocabularyRevision += 1;
    }
}
