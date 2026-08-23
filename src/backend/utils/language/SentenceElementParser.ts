import winkNLP from 'wink-nlp';
import type { ItsFunction } from 'wink-nlp';
import model from 'wink-eng-lite-web-model';

const nlp = winkNLP(model);

/** 句子中的结构化元素。 */
export interface SentenceElement {
    /** 元素类型。 */
    kind: 'word' | 'text';
    /** 字幕中的原文片段，始终用于展示。 */
    text: string;
    /** wink 根据上下文和词性推导出的 lemma，仅用于内部匹配。 */
    implicit?: string;
    /** wink 识别出的词性。 */
    pos?: string;
    /** wink 识别出的 token 类型。 */
    type?: string;
    /** 在原句中的起始位置。 */
    start: number;
    /** 在原句中的文本长度。 */
    length: number;
}

/** 将句子解析为完整元素流。 */
export interface SentenceElementParser { parse(text: string): SentenceElement[]; }

/**
 * 基于 wink-nlp 的句子元素解析器。
 * wink 对整句进行分词、词性标注和归一化，同时通过原文偏移保留展示文本。
 */
export class WinkSentenceElementParser implements SentenceElementParser {
    /**
     * 分析一整句字幕并保留原文覆盖范围。
     * @param text 待解析字幕原文。
     * @returns 按原文顺序排列、完整覆盖输入文本的元素。
     */
    parse(text: string): SentenceElement[] {
        if (!text) return [];
        const doc = nlp.readDoc(text);
        const values = doc.tokens().out(nlp.its.value as unknown as ItsFunction<string>) as string[];
        const lemmas = doc.tokens().out(nlp.its.lemma as unknown as ItsFunction<string>) as string[];
        const types = doc.tokens().out(nlp.its.type as unknown as ItsFunction<string>) as string[];
        const poses = doc.tokens().out(nlp.its.pos as unknown as ItsFunction<string>) as string[];
        const tokens: Array<{ text: string; lemma: string; type: string; pos: string; start: number }> = [];
        let cursor = 0;
        values.forEach((value, index) => {
            const start = text.indexOf(value, cursor);
            if (start < 0) return;
            tokens.push({ text: value, lemma: lemmas[index] ?? value, type: types[index] ?? 'text', pos: poses[index] ?? '', start });
            cursor = start + value.length;
        });
        const elements: SentenceElement[] = [];
        cursor = 0;
        tokens.forEach((token) => {
            if (token.start > cursor) elements.push({ kind: 'text', text: text.slice(cursor, token.start), start: cursor, length: token.start - cursor });
            const isWord = token.type === 'word';
            elements.push({ kind: isWord ? 'word' : 'text', text: token.text, implicit: isWord ? token.lemma : undefined, pos: token.pos, type: token.type, start: token.start, length: token.text.length });
            cursor = token.start + token.text.length;
        });
        if (cursor < text.length) elements.push({ kind: 'text', text: text.slice(cursor), start: cursor, length: text.length - cursor });
        return elements.filter((element) => element.length > 0);
    }
}
