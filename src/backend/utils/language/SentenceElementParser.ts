import nlp from 'compromise/one';

/**
 * 句子中的结构化元素。
 */
export interface SentenceElement {
    /**
     * 元素类型。
     */
    kind: 'word' | 'text';
    /**
     * 原文中的文本片段。
     */
    text: string;
    /**
     * compromise 推导出的隐式形态；仅 `word` 元素会提供。
     */
    implicit?: string;
    /**
     * 在原句中的起始位置。
     */
    start: number;
    /**
     * 在原句中的文本长度。
     */
    length: number;
}

/**
 * 将句子解析为完整元素流。
 */
export interface SentenceElementParser {
    parse(text: string): SentenceElement[];
}

type RawWordToken = {
    text: string;
    implicit: string;
    start: number;
    length: number;
};

/**
 * 基于 compromise 的句子元素解析器。
 */
export class CompromiseSentenceElementParser implements SentenceElementParser {

    /**
     * 解析句子并返回完整元素流。
     *
     * 行为说明：
     * - 输出会完整覆盖原句内容。
     * - 单词片段使用 `kind='word'` 表示。
     * - 空格、标点与其他未命中部分使用 `kind='text'` 表示。
     *
     * @param text 待解析句子。
     * @returns 按原文顺序排列的元素列表。
     */
    parse(text: string): SentenceElement[] {
        if (!text) {
            return [];
        }

        const wordTokens = normalizeContractions(this.extractWordTokens(text));
        const elements: SentenceElement[] = [];
        let cursor = 0;

        for (const token of wordTokens) {
            if (token.start > cursor) {
                elements.push({
                    kind: 'text',
                    text: text.slice(cursor, token.start),
                    start: cursor,
                    length: token.start - cursor,
                });
            }

            elements.push({
                kind: 'word',
                text: token.text,
                implicit: token.implicit,
                start: token.start,
                length: token.length,
            });
            cursor = token.start + token.length;
        }

        if (cursor < text.length) {
            elements.push({
                kind: 'text',
                text: text.slice(cursor),
                start: cursor,
                length: text.length - cursor,
            });
        }

        return elements.filter((element) => element.length > 0);
    }

    /**
     * 提取原始单词 token。
     *
     * @param text 待解析句子。
     * @returns 原始单词 token 列表。
     */
    private extractWordTokens(text: string): RawWordToken[] {
        const doc = nlp(text);
        const offset = doc.out('offset') as {
            terms: {
                text: string;
                implicit: string | undefined;
                offset: {
                    start: number;
                    length: number;
                };
            }[];
        }[];

        return offset.map(item => item.terms ?? [])
            .flat()
            .map((item) => ({
                text: item.text,
                implicit: item.implicit ?? item.text,
                start: item.offset.start,
                length: item.offset.length,
            }));
    }
}

/**
 * 修正缩写拆分后的位置信息。
 *
 * @param tokens 原始 token 列表。
 * @returns 规整后的 token 列表。
 */
function normalizeContractions(tokens: RawWordToken[]): RawWordToken[] {
    const results: RawWordToken[] = [];

    for (const token of tokens) {
        if (token.length > 0) {
            results.push(token);
            continue;
        }

        if (token.text.length === 0) {
            continue;
        }

        const last = results.pop();
        if (!last) {
            continue;
        }

        const parts = last.text.split('\'');
        if (parts.length === 1) {
            results.push(last);
            continue;
        }

        const prefix = parts[0];
        const suffix = parts.slice(1).join('\'');
        last.text = prefix;
        last.length = prefix.length;

        token.text = `${suffix}${token.text}`;
        token.start -= suffix.length;
        token.length += suffix.length;

        results.push(last);
        results.push(token);
    }

    return results;
}
