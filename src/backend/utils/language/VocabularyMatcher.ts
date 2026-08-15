import nlp from 'compromise';

const ENGLISH_TOKEN_PATTERN = /[a-zA-Z]+(?:-[a-zA-Z]+)*/g;

/**
 * 文本中提取出的单词候选。
 */
export interface TextWordCandidate {
    /**
     * 原文中实际出现的词形。
     */
    original: string;
    /**
     * 按匹配优先级排序的候选形态。
     */
    forms: string[];
}

/**
 * 词表匹配输入项。
 */
export interface VocabularyEntry<TPayload> {
    /**
     * 词表中的原始词条文本。
     */
    text: string;
    /**
     * 调用方随词条携带的业务对象。
     */
    payload: TPayload;
}

/**
 * 词表命中结果。
 */
export interface VocabularyMatch<TPayload> {
    /**
     * 文本里实际命中的原文片段。
     */
    original: string;
    /**
     * 归一化后的基础形态。
     */
    normalized: string;
    /**
     * 命中的业务对象。
     */
    payload: TPayload;
}

/**
 * 统一的词表匹配器。
 *
 * 行为说明：
 * - 对外只暴露一个 `match` 方法。
 * - 内部会按词条类型自动区分单词与词组匹配。
 */
export interface VocabularyMatcher<TPayload> {
    match(text: string): VocabularyMatch<TPayload>[];
}

type PreparedWordEntry<TPayload> = {
    entry: VocabularyEntry<TPayload>;
    forms: string[];
};

type PreparedPhraseEntry<TPayload> = {
    entry: VocabularyEntry<TPayload>;
    tokens: PreparedWordEntry<TPayload>[];
};

/**
 * 从普通文本中提取可用于匹配的单词候选。
 */
interface TextWordCandidateExtractor {
    extractFromText(text: string): TextWordCandidate[];
}

/**
 * 将单个单词解析为可用于匹配的多种词形。
 */
interface WordFormResolver {
    resolve(word: string): string[];
}

/**
 * 基于 compromise 的词表匹配器。
 */
export class CompromiseVocabularyMatcher<TPayload> implements VocabularyMatcher<TPayload> {

    private readonly textWordCandidateExtractor: TextWordCandidateExtractor = new CompromiseTextWordCandidateExtractor();
    private readonly wordFormResolver: WordFormResolver = new CompromiseWordFormResolver();
    private readonly wordIndex = new Map<string, VocabularyEntry<TPayload>>();
    private readonly phraseEntries: PreparedPhraseEntry<TPayload>[] = [];

    constructor(entries: VocabularyEntry<TPayload>[]) {
        this.prepare(entries);
    }

    /**
     * 在当前词表快照上匹配一段文本。
     *
     * @param text 待匹配文本。
     * @returns 命中结果。
     */
    match(text: string): VocabularyMatch<TPayload>[] {
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            return [];
        }

        const candidates = this.textWordCandidateExtractor.extractFromText(text);
        if (candidates.length === 0) {
            return [];
        }

        const phraseMatches = this.matchPhrases(candidates);
        const wordMatches = this.matchSingleWords(candidates);

        return [...phraseMatches, ...wordMatches];
    }

    /**
     * 预编译词表项，分别构建单词索引和词组索引。
     *
     * @param entries 词表输入项。
     */
    private prepare(entries: VocabularyEntry<TPayload>[]) {
        for (const entry of entries) {
            const normalizedText = normalizeEntryText(entry.text);
            if (!normalizedText) {
                continue;
            }

            if (isPhraseEntry(normalizedText)) {
                const phraseEntry = this.preparePhraseEntry(entry, normalizedText);
                if (phraseEntry) {
                    this.phraseEntries.push(phraseEntry);
                }
                continue;
            }

            const forms = this.wordFormResolver.resolve(normalizedText);
            if (forms.length === 0) {
                continue;
            }

            for (const form of forms) {
                this.wordIndex.set(form, entry);
            }
        }
    }

    /**
     * 将短语词条预处理为逐 token 的匹配结构。
     *
     * @param entry 原始词条。
     * @param normalizedText 归一化后的词条文本。
     * @returns 预处理后的短语结构。
     */
    private preparePhraseEntry(entry: VocabularyEntry<TPayload>, normalizedText: string): PreparedPhraseEntry<TPayload> | null {
        const tokens = tokenizePhrase(normalizedText);
        if (tokens.length === 0) {
            return null;
        }

        const preparedTokens = tokens
            .map((token) => {
                const forms = this.wordFormResolver.resolve(token);
                if (forms.length === 0) {
                    return null;
                }

                return {
                    entry,
                    forms,
                };
            })
            .filter((token): token is PreparedWordEntry<TPayload> => token !== null);

        if (preparedTokens.length !== tokens.length) {
            return null;
        }

        return {
            entry,
            tokens: preparedTokens,
        };
    }

    /**
     * 执行单词级匹配。
     *
     * @param candidates 文本中的单词候选。
     * @returns 单词命中结果。
     */
    private matchSingleWords(candidates: TextWordCandidate[]): VocabularyMatch<TPayload>[] {
        const matchedWords: VocabularyMatch<TPayload>[] = [];

        for (const candidate of candidates) {
            const matchedEntry = this.findWordEntry(candidate.forms);
            if (!matchedEntry) {
                continue;
            }

            matchedWords.push({
                original: candidate.original,
                normalized: candidate.forms[1] ?? candidate.forms[0] ?? '',
                payload: matchedEntry.payload,
            });
        }

        return matchedWords;
    }

    /**
     * 执行短语级匹配。
     *
     * @param candidates 文本中的单词候选。
     * @returns 短语命中结果。
     */
    private matchPhrases(candidates: TextWordCandidate[]): VocabularyMatch<TPayload>[] {
        if (this.phraseEntries.length === 0) {
            return [];
        }

        const matchedPhrases: VocabularyMatch<TPayload>[] = [];

        for (let start = 0; start < candidates.length; start++) {
            for (const phraseEntry of this.phraseEntries) {
                if (!this.matchesPhraseAt(candidates, start, phraseEntry)) {
                    continue;
                }

                const phraseCandidates = candidates.slice(start, start + phraseEntry.tokens.length);
                matchedPhrases.push({
                    original: phraseCandidates.map((candidate) => candidate.original).join(' '),
                    normalized: normalizeEntryText(phraseEntry.entry.text),
                    payload: phraseEntry.entry.payload,
                });
            }
        }

        return matchedPhrases;
    }

    /**
     * 判断某个短语是否在指定起点连续命中。
     *
     * @param candidates 文本中的单词候选。
     * @param start 起始位置。
     * @param phraseEntry 预处理后的短语结构。
     * @returns 是否命中。
     */
    private matchesPhraseAt(
        candidates: TextWordCandidate[],
        start: number,
        phraseEntry: PreparedPhraseEntry<TPayload>
    ): boolean {
        if (start + phraseEntry.tokens.length > candidates.length) {
            return false;
        }

        for (let index = 0; index < phraseEntry.tokens.length; index++) {
            const candidate = candidates[start + index];
            const phraseToken = phraseEntry.tokens[index];
            if (!candidate || !phraseToken || !hasIntersection(candidate.forms, phraseToken.forms)) {
                return false;
            }
        }

        return true;
    }

    /**
     * 按优先级在单词索引中查找命中的词条。
     *
     * @param forms 候选形态。
     * @returns 命中的词条。
     */
    private findWordEntry(forms: string[]): VocabularyEntry<TPayload> | undefined {
        for (const form of forms) {
            const matchedEntry = this.wordIndex.get(form);
            if (matchedEntry) {
                return matchedEntry;
            }
        }

        return undefined;
    }
}

/**
 * 从文本中提取单词候选，并仅对普通单词使用库做归一化。
 */
class CompromiseTextWordCandidateExtractor implements TextWordCandidateExtractor {

    /**
     * 从普通文本中提取单词候选。
     *
     * @param text 待分析文本。
     * @returns 可参与匹配的单词候选。
     */
    extractFromText(text: string): TextWordCandidate[] {
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            return [];
        }

        const terms = this.extractTerms(text);
        const results: TextWordCandidate[] = [];

        for (const term of terms) {
            if (!term || typeof term !== 'string') {
                continue;
            }

            const candidate = analyzeWord(term);
            const primaryForm = candidate.forms[0] ?? '';
            if (!primaryForm || primaryForm.length < 2) {
                continue;
            }

            results.push(candidate);
        }

        return results;
    }

    /**
     * 提取文本中的英文词项。
     *
     * @param text 待分析文本。
     * @returns 原始词项列表。
     */
    private extractTerms(text: string): string[] {
        return text.match(ENGLISH_TOKEN_PATTERN) ?? [];
    }
}

/**
 * 使用 compromise 解析单个单词词形。
 */
class CompromiseWordFormResolver implements WordFormResolver {

    /**
     * 解析单个单词的多种匹配形态。
     *
     * 行为说明：
     * - 仅接受单个单词，不处理短语。
     * - 返回值按匹配优先级排序。
     *
     * @param word 待解析单词。
     * @returns 可参与匹配的词形列表。
     */
    resolve(word: string): string[] {
        const normalizedWord = normalizeEntryText(word);
        if (!normalizedWord) {
            return [];
        }

        if (!isPlainEnglishWord(normalizedWord)) {
            return [normalizedWord];
        }

        return Array.from(new Set([
            normalizedWord,
            getLemma(normalizedWord),
        ].filter((form) => typeof form === 'string' && form.length > 0)));
    }
}

/**
 * 分析单个英文词的归一化形态。
 *
 * @param term 原始单词。
 * @returns 匹配候选项。
 */
function analyzeWord(term: string): TextWordCandidate {
    const lower = normalizeEntryText(term);
    if (!lower) {
        return {
            original: term,
            forms: [],
        };
    }

    if (!isPlainEnglishWord(lower)) {
        return {
            original: term,
            forms: [lower],
        };
    }

    const forms = Array.from(new Set([
        lower,
        getLemma(lower),
    ].filter((form) => typeof form === 'string' && form.length > 0)));

    return {
        original: term,
        forms,
    };
}

/**
 * 将词条文本归一化为小写文本。
 *
 * @param text 原始词条。
 * @returns 归一化后的文本。
 */
function normalizeEntryText(text: string): string {
    return typeof text === 'string' ? text.toLowerCase().trim() : '';
}

/**
 * 判断文本是否为普通英文单词。
 *
 * @param text 归一化后的文本。
 * @returns 是否仅包含英文字母。
 */
function isPlainEnglishWord(text: string): boolean {
    return /^[a-z]+$/.test(text);
}

/**
 * 判断词条是否为包含多个 token 的短语。
 *
 * @param text 归一化后的词条文本。
 * @returns 是否为短语。
 */
function isPhraseEntry(text: string): boolean {
    return /\s+/.test(text);
}

/**
 * 将短语拆分为连续英文 token。
 *
 * @param text 归一化后的短语文本。
 * @returns 短语 token 列表。
 */
function tokenizePhrase(text: string): string[] {
    return text.match(ENGLISH_TOKEN_PATTERN) ?? [];
}

/**
 * 判断两个词形集合是否存在交集。
 *
 * @param left 左侧词形集合。
 * @param right 右侧词形集合。
 * @returns 是否命中。
 */
function hasIntersection(left: string[], right: string[]): boolean {
    const rightSet = new Set(right);
    return left.some((item) => rightSet.has(item));
}

/**
 * 基于词性做词形还原。
 *
 * @param term 小写后的单词。
 * @returns 还原后的基础形态。
 */
function getLemma(term: string): string {
    try {
        const doc = nlp(term);

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
            const adjectives = doc.adjectives();
            const baseForm = (adjectives.conjugate()[0] as { Adjective?: string } | undefined)?.Adjective;
            if (typeof baseForm === 'string' && baseForm.length > 0) {
                return baseForm.toLowerCase();
            }
        }

        const normal = doc.terms().out('normal');
        return (Array.isArray(normal) ? normal[0] : normal)?.toLowerCase() || term;
    } catch (error) {
        return term;
    }
}
