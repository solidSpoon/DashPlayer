import winkNLP from 'wink-nlp';
import type { ItsFunction } from 'wink-nlp';
import model from 'wink-eng-lite-web-model';

const nlp = winkNLP(model);

/** 词表匹配输入项。 */
export interface VocabularyEntry<TPayload> { text: string; payload: TPayload; }
/** 词表命中结果。 */
export interface VocabularyMatch<TPayload> { original: string; normalized: string; payload: TPayload; }
/** 基于字幕 token lemma 的单向词表匹配器。 */
export interface VocabularyMatcher<TPayload> { match(text: string): VocabularyMatch<TPayload>[]; }

/**
 * 字幕侧使用 wink 的 POS-aware lemma 查询索引；词表侧保留用户输入原文，
 * 不拆分、不做 lemma 归一化，也不生成额外词形。
 */
export class WinkVocabularyMatcher<TPayload> implements VocabularyMatcher<TPayload> {
    private readonly wordIndex = new Map<string, VocabularyEntry<TPayload>>();

    /**
     * 编译词表 lemma 索引。
     * @param entries 词表原始词条及其业务对象。
     */
    constructor(entries: VocabularyEntry<TPayload>[]) {
        entries.forEach((entry) => {
            const key = entry.text.trim().toLowerCase();
            if (!key) return;
            this.wordIndex.set(key, entry);
        });
    }

    /**
     * 分析整段字幕并按 lemma 查找词表。
     * @param text 一行字幕原文。
     * @returns 命中的原文词形和对应词表条目。
     */
    match(text: string): VocabularyMatch<TPayload>[] {
        if (!text?.trim()) return [];
        return this.analyze(text).flatMap((token) => {
            if (token.type !== 'word') return [];
            const lemma = token.lemma.toLowerCase();
            const entry = this.wordIndex.get(lemma);
            return entry ? [{ original: token.text, normalized: lemma, payload: entry.payload }] : [];
        });
    }

    /**
     * 对单段文本执行一次 wink 分词、词性标注和 lemma 归一化。
     * @param text 原文。
     * @returns token 语义信息。
     */
    private analyze(text: string): Array<{ text: string; lemma: string; type: string }> {
        const doc = nlp.readDoc(text);
        const values = doc.tokens().out(nlp.its.value as unknown as ItsFunction<string>) as string[];
        const lemmas = doc.tokens().out(nlp.its.lemma as unknown as ItsFunction<string>) as string[];
        const types = doc.tokens().out(nlp.its.type as unknown as ItsFunction<string>) as string[];
        return values.map((value, index) => ({ text: value, lemma: lemmas[index] ?? value, type: types[index] ?? 'text' }));
    }
}
