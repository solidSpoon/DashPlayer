import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import BuiltinDictionaryStore from '@/backend/services/gateways/translate/BuiltinDictionaryStore';
import { WordMatchService } from '@/backend/services/WordMatchService';
import { analyzeWords } from '@/backend/utils/language/VocabularyMatcher';
import { OpenAIDictionaryResult } from '@/common/types/DictionaryResult';
import { SentenceVocabularyVO, SentenceWordEntry } from '@/common/types/vo/SentenceVocabularyVO';

/**
 * 句子生词服务契约：用一个句子产出「值得重点认识的词」与「句内逐词释义」。
 */
export default interface SentenceVocabularyService {
    pick(text: string): Promise<SentenceVocabularyVO>;
}

/** 展示用释义最多合并的词典释义条数。 */
const MEANING_MAX_PARTS = 2;

/** 卡片太少时补位到的下限，避免预习区太空。 */
const MIN_CARDS = 3;

/**
 * 中国英语教学中「初中阶段已覆盖」的标签：这类词（bike、socks、math 这种）不再占用生词位。
 *
 * 说明：高考（gk）标签刻意不在这里——高考大纲词里有大量学习者需要复习的词，
 * 一刀切排除会漏掉真正该讲的词；它们改由下面的牛津核心 / 柯林斯星级 / 高频规则兜底。
 */
const MIDDLE_SCHOOL_TAGS = ['zk'];

/** 卡片候选：只记录词条与句内顺序，展示顺序一律按句内出现顺序。 */
type Candidate = {
    /** 展示用词条。 */
    word: SentenceWordEntry;
    /** 词在句中的 token 序号。 */
    order: number;
};

/** 补位候选：额外记录罕见度，用于决定「哪几张」来补位。 */
type FillerCandidate = Candidate & {
    /** 词频排名，越大越罕见；0 表示无排名，视为最罕见。 */
    rank: number;
    /** 柯林斯星级，同频时星级低的优先。 */
    collins: number;
};

/**
 * 判断词条是否属于「谁都会」的词。
 *
 * 判断依据全部取自本地词典，不依赖模型：
 * - 牛津核心词、柯林斯 4 星及以上：母语者日常核心词，中国学生也基本学过；
 * - BNC 排名前 2000：极高频词；
 * - 带中考标签：初中阶段已覆盖。
 *
 * @param entry 本地词典词条。
 * @returns 属于「谁都会」时为 true。
 */
const isTooCommon = (entry: OpenAIDictionaryResult): boolean => {
    if (entry.oxford && entry.oxford > 0) {
        return true;
    }
    if ((entry.collins ?? 0) >= 4) {
        return true;
    }
    if ((entry.bnc ?? 0) > 0 && (entry.bnc ?? 0) <= 2000) {
        return true;
    }
    const tags = entry.tags ?? [];
    return tags.some((tag) => MIDDLE_SCHOOL_TAGS.includes(tag));
};

/**
 * 补位排序：词频排名越靠后（越罕见）越先补位，同频再看柯林斯星级，最后按句内顺序。
 *
 * 说明：补位只在主线一张都选不出、或数量太少时启用，所以取的是被规则挡掉的词里
 * 「相对最罕见」的那几个；它不参与主线选词。
 *
 * @param a 补位候选 A。
 * @param b 补位候选 B。
 * @returns 排序结果。
 */
const compareFiller = (a: FillerCandidate, b: FillerCandidate): number => {
    const rankDiff = b.rank - a.rank;
    if (rankDiff !== 0) {
        return rankDiff;
    }
    const collinsDiff = a.collins - b.collins;
    return collinsDiff !== 0 ? collinsDiff : a.order - b.order;
};

/**
 * 把一个词形并入卡片候选：同一个词的多种变形（watch / watching）合并成一张卡，
 * 只保留首次出现的句内顺序，词形累积到 surfaces 供界面高亮。
 *
 * @param target 按词条原形索引的候选表。
 * @param candidate 本次命中的候选。
 */
const addPick = (target: Map<string, Candidate>, candidate: Candidate): void => {
    const existing = target.get(candidate.word.word);
    if (existing) {
        existing.word.surfaces.push(...candidate.word.surfaces);
        return;
    }
    target.set(candidate.word.word, candidate);
};

/**
 * 把一个词形并入补位候选（合并规则同 addPick）。
 *
 * @param target 按词条原形索引的补位候选表。
 * @param candidate 本次命中的补位候选。
 */
const addFiller = (target: Map<string, FillerCandidate>, candidate: FillerCandidate): void => {
    const existing = target.get(candidate.word.word);
    if (existing) {
        existing.word.surfaces.push(...candidate.word.surfaces);
        return;
    }
    target.set(candidate.word.word, candidate);
};

/**
 * 把词典释义压成一行卡片文案。
 *
 * @param entry 本地词典词条。
 * @returns 形如 `v. 大摇大摆地走；n. 华尔兹` 的释义文本。
 */
const toMeaning = (entry: OpenAIDictionaryResult): string => entry.definitions
    .slice(0, MEANING_MAX_PARTS)
    .map((definition) => (definition.partOfSpeech
        ? `${definition.partOfSpeech} ${definition.meaning}`
        : definition.meaning))
    .join('；');

/**
 * 本地词典驱动的句子生词选词。
 *
 * 行为说明：
 * - 全程只读本地词典与本地词表：不调用模型、不访问网络，因此结果稳定且可在打开页面时立即可用；
 * - 先按 wink 的 token 与 lemma 归一化，再用 lemma 查词，避免把变形词当成独立生词；
 * - 含撇号的缩略词（can't / I'm）直接跳过：去标点后会命中另一个词条（如 cant）；
 * - 句内所有词都会返回释义映射，单词卡只从中挑出值得重点认识的几条。
 *
 * 选词与排序是两件事：
 * - 「哪些词进卡片」由难度规则决定：用户词表命中的词 + 本地词典里「不算谁都会」的词；
 *   一张都选不出或数量太少时，才用被挡掉的词里相对最罕见的几个补位；
 * - 「卡片怎么排」一律按词在句中出现的顺序，不按难度或词频。
 */
@injectable()
export class SentenceVocabularyServiceImpl implements SentenceVocabularyService {
    @inject(TYPES.BuiltinDictionaryStore)
    private builtinDictionaryStore!: BuiltinDictionaryStore;

    @inject(TYPES.WordMatchService)
    private wordMatchService!: WordMatchService;

    public async pick(text: string): Promise<SentenceVocabularyVO> {
        const details: Record<string, SentenceWordEntry> = {};
        const picked = new Map<string, Candidate>();
        const fillers = new Map<string, FillerCandidate>();
        const seen = new Set<string>();
        const vocabularyIndex = await this.buildVocabularyIndex();

        analyzeWords(text).forEach((token, order) => {
            if (token.type !== 'word') {
                return;
            }
            // 缩略词去掉撇号后会命中同形的其它词条，直接跳过
            if (token.text.includes('\'') || token.text.includes('’')) {
                return;
            }
            const surface = token.text.toLowerCase();
            if (surface.length <= 2 || /^\d+$/.test(surface) || seen.has(surface)) {
                return;
            }
            // 句首之外的大写词视为专名，不作为生词
            if (order > 0 && /^[A-Z]/.test(token.text)) {
                return;
            }
            seen.add(surface);

            const dictionaryEntry = this.lookup(token.lemma, surface);
            const vocabularyEntry = this.matchVocabulary(vocabularyIndex, token.lemma, surface);
            if (!dictionaryEntry && !vocabularyEntry) {
                return;
            }

            const word: SentenceWordEntry = {
                word: (vocabularyEntry?.word ?? dictionaryEntry?.word ?? surface).toLowerCase(),
                phonetic: dictionaryEntry?.phonetic ?? '',
                // 用户词表里的词以他自己的译文为准，尊重他改过的释义
                meaning: (vocabularyEntry?.translate ?? '').trim()
                    || (dictionaryEntry ? toMeaning(dictionaryEntry) : ''),
                tags: dictionaryEntry?.tags ?? [],
                surfaces: [surface],
            };
            if (!word.meaning) {
                return;
            }
            details[surface] = word;

            // 用户词表命中的词一律视为难词，直接进卡片
            if (vocabularyEntry) {
                addPick(picked, { word, order });
                return;
            }
            if (!dictionaryEntry) {
                return;
            }
            if (isTooCommon(dictionaryEntry)) {
                // 「谁都会」的词不主动展示，仅在卡片太少时用于补位（只取考纲内的词，徽章能说明来由）
                if (word.tags.length > 0) {
                    addFiller(fillers, {
                        word,
                        order,
                        rank: (dictionaryEntry.bnc ?? 0) > 0 ? dictionaryEntry.bnc! : Number.MAX_SAFE_INTEGER,
                        collins: dictionaryEntry.collins ?? 0,
                    });
                }
                return;
            }
            addPick(picked, { word, order });
        });

        const selected: Candidate[] = [...picked.values()];
        if (selected.length < MIN_CARDS) {
            selected.push(
                ...[...fillers.values()]
                    .sort(compareFiller)
                    .slice(0, MIN_CARDS - selected.length)
            );
        }

        return {
            // 卡片只按句中出现顺序排列
            picks: selected.sort((a, b) => a.order - b.order).map((candidate) => candidate.word),
            details,
        };
    }

    /**
     * 载入用户生词表并建立「小写词形 -> 词表条目」索引。
     *
     * 说明：这里直接读词表而不是复用 WinkVocabularyMatcher，是因为选词需要每个词在句中的位置，
     * 必须与分词结果共享同一套 token 序号。
     *
     * @returns 词表索引。
     */
    private async buildVocabularyIndex(): Promise<Map<string, { word: string; translate: string | null }>> {
        const words = await this.wordMatchService.getVocabularyWords();
        const index = new Map<string, { word: string; translate: string | null }>();
        words.forEach((entry) => {
            const key = entry.word?.trim().toLowerCase();
            if (key) {
                index.set(key, { word: entry.word, translate: entry.translate });
            }
        });
        return index;
    }

    /**
     * 按 lemma 与原词形查用户词表。
     *
     * @param index 词表索引。
     * @param lemma wink 归一化后的词形。
     * @param surface 句中实际出现的词形（小写）。
     * @returns 命中的词表条目；未命中返回 null。
     */
    private matchVocabulary(
        index: Map<string, { word: string; translate: string | null }>,
        lemma: string,
        surface: string
    ): { word: string; translate: string | null } | null {
        const normalizedLemma = (lemma ?? '').toLowerCase().trim();
        return index.get(normalizedLemma) ?? index.get(surface) ?? null;
    }

    /**
     * 按 lemma 查词，未命中时退回原词形。
     *
     * 说明：词库中存在 watching、wanted 这类独立条目，但它们的词频数据不完整，
     * 直接用变形词查询会把常见词的变形误判成生词，因此优先查 lemma。
     *
     * @param lemma wink 归一化后的词形。
     * @param surface 句中实际出现的词形（小写）。
     * @returns 命中的词典词条；均未命中返回 null。
     */
    private lookup(lemma: string, surface: string): OpenAIDictionaryResult | null {
        const normalizedLemma = (lemma ?? '').toLowerCase().trim();
        if (normalizedLemma && normalizedLemma !== surface) {
            const byLemma = this.builtinDictionaryStore.lookup(normalizedLemma);
            if (byLemma) {
                return byLemma;
            }
        }
        return this.builtinDictionaryStore.lookup(surface);
    }
}
