import { Word } from '@/backend/infrastructure/db/tables/words';
import nlp from 'compromise';
import { inject, injectable } from 'inversify';
import {MatchedWord, WordMatchService} from '@/backend/application/services/WordMatchService';
import TYPES from '@/backend/ioc/types';
import WordsRepository from '@/backend/application/ports/repositories/WordsRepository';

@injectable()
export default class WordMatchServiceImpl implements WordMatchService {

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

        const vocabIndex = this.buildVocabIndex(vocabularyWords);

        return texts.map(text => this.matchSingleText(text, vocabularyWords, vocabIndex));
    }

    private matchSingleText(text: string, vocabularyWords: Word[], vocabIndex: Map<string, Word>): MatchedWord[] {
        // 检查输入文本
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            return [];
        }

        const matchedWords: MatchedWord[] = [];

        try {
            // 使用compromise.js解析文本，提取单词
            const doc = nlp(text);
            if (!doc || !doc.terms) {
                return this.fallbackWordMatch(text, vocabularyWords, vocabIndex);
            }

            // 获取所有terms
            const terms = doc.terms();
            const termList = terms.out('array');

            if (!termList || termList.length === 0) {
                return this.fallbackWordMatch(text, vocabularyWords, vocabIndex);
            }

            // 去重处理
            const processedTerms = new Set<string>();

            for (let i = 0; i < termList.length; i++) {
                const term = termList[i];
                if (!term || typeof term !== 'string') continue;

                // 清理term但保留原始形态用于匹配
                const cleanTerm = term.toLowerCase().trim();
                if (!cleanTerm || cleanTerm.length < 2 || processedTerms.has(cleanTerm)) continue;

                processedTerms.add(cleanTerm);

                try {
                    // 获取单词的各种形态
                    const normalized = this.getLemma(term);
                    const stem = this.getStem(term);

                    // 检查是否匹配数据库中的单词
                    const matchedWord = this.findMatchingWordInIndex(cleanTerm, normalized, stem, vocabIndex);

                    if (matchedWord) {
                        matchedWords.push({
                            original: term,
                            normalized,
                            stem,
                            databaseWord: matchedWord
                        });
                    }
                } catch (termError) {
                    // 忽略单个term的处理错误，继续处理下一个
                    continue;
                }
            }
        } catch (error) {
            // 如果compromise.js处理失败，尝试简单的单词匹配
            return this.fallbackWordMatch(text, vocabularyWords, vocabIndex);
        }

        return matchedWords;
    }

    // 构建词库索引
    private buildVocabIndex(vocabularyWords: Word[]): Map<string, Word> {
        const index = new Map<string, Word>();

        for (const word of vocabularyWords) {
            const lower = word.word.toLowerCase();
            const stem = (word.stem || '').toLowerCase();

            // 添加原始形态
            index.set(lower, word);

            // 如果有词干，也添加到索引
            if (stem && stem !== lower) {
                index.set(stem, word);
            }
        }

        return index;
    }

    // 获取单词的lemma（词形还原）
    private getLemma(term: string): string {
        try {
            const doc = nlp(term);

            // 尝试根据词性进行还原
            if (doc.has('#Verb')) {
                const infinitive = doc.verbs().toInfinitive().out('text');
                if (infinitive && infinitive.length > 0) {
                    return infinitive.toLowerCase();
                }
            }

            if (doc.has('#Noun')) {
                const singular = doc.nouns().toSingular().out('text');
                if (singular && singular.length > 0) {
                    return singular.toLowerCase();
                }
            }

            if (doc.has('#Adjective')) {
                const adjectives = (doc as any).adjectives?.();
                const positive = adjectives?.toPositive?.().out?.('text');
                if (typeof positive === 'string' && positive.length > 0) {
                    return positive.toLowerCase();
                }
            }

            // 回退到normal form
            const normal = doc.terms().out('normal');
            return (Array.isArray(normal) ? normal[0] : normal)?.toLowerCase() || term.toLowerCase();

        } catch (error) {
            return term.toLowerCase();
        }
    }

    // 获取单词的词干
    private getStem(term: string): string {
        try {
            // 简单的词干提取逻辑
            let stem = term.toLowerCase();

            // 常见的后缀移除
            const suffixes = ['ing', 'ed', 'es', 's', 'er', 'est', 'ly'];
            for (const suffix of suffixes) {
                if (stem.endsWith(suffix) && stem.length > suffix.length + 2) {
                    stem = stem.substring(0, stem.length - suffix.length);
                    break;
                }
            }

            return stem;
        } catch (error) {
            return term.toLowerCase();
        }
    }

    // 在索引中查找匹配的单词
    private findMatchingWordInIndex(original: string, normalized: string, stem: string, vocabIndex: Map<string, Word>): Word | undefined {
        // 按优先级查找：原始形态 > 标准化形态 > 词干
        return vocabIndex.get(original) || vocabIndex.get(normalized) || vocabIndex.get(stem);
    }

    // 备用的简单单词匹配方法
    private fallbackWordMatch(text: string, vocabularyWords: Word[], vocabIndex: Map<string, Word>): MatchedWord[] {
        const matchedWords: MatchedWord[] = [];

        // 构建简单的词库索引
        const vocabSet = new Set(vocabularyWords.map(w => w.word.toLowerCase()));

        // 简单的单词分割
        const words = text.toLowerCase()
            .split(/\s+/)
            .filter(word => {
                const clean = word.replace(/[^\w]/g, '');
                return clean && clean.length > 1 && /^[a-zA-Z]+$/.test(clean);
            });

        const processed = new Set<string>();

        for (const word of words) {
            const cleanWord = word.replace(/[^\w]/g, '');
            if (processed.has(cleanWord)) continue;
            processed.add(cleanWord);

            if (vocabSet.has(cleanWord)) {
                const matchedWord = this.findMatchingWordInIndex(cleanWord, cleanWord, cleanWord, vocabIndex);
                if (matchedWord) {
                    matchedWords.push({
                        original: word,
                        normalized: cleanWord,
                        stem: cleanWord,
                        databaseWord: matchedWord
                    });
                }
            }
        }

        return matchedWords;
    }

    async getVocabularyWords(): Promise<Word[]> {
        return await this.wordsRepository.getAll();
    }

    private findMatchingWord(original: string, normalized: string, stem: string, vocabularyWords: Word[]): Word | undefined {
        for (const word of vocabularyWords) {
            const wordLower = word.word.toLowerCase();
            const wordStem = word.stem?.toLowerCase() || wordLower;

            // 检查多种匹配方式
            if (
                original === wordLower ||           // 完全匹配
                normalized === wordLower ||         // 标准化匹配
                stem === wordStem ||                // 词干匹配
                original === wordStem ||            // 原始词匹配数据库词干
                normalized === wordStem ||           // 标准化词匹配数据库词干
                stem === wordLower ||               // 词干匹配数据库单词
                wordLower.includes(original) ||    // 数据库单词包含原始词
                original.includes(wordLower)        // 原始词包含数据库单词
            ) {
                return word;
            }
        }
        return undefined;
    }
}
