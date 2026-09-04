/**
 * 单词/非单词切分正则：在字母、数字、中文、连字符与其他字符的边界切开。
 */
export const SPLIT_REGEX =
    /((?<=.)(?=[^A-Za-z0-9\u4e00-\u9fa5-]))|((?<=[^A-Za-z0-9\u4e00-\u9fa5-])(?=.))/;

const NO_WORD_REGEX = /[^A-Za-z0-9-\u4e00-\u9fa5]/;

/**
 * 判断切分出的片段是否为单词（字母/数字/中文/连字符组成）。
 *
 * @param str 切分片段。
 * @returns 是单词时返回 true。
 */
export function isWordToken(str: string): boolean {
    return !NO_WORD_REGEX.test(str);
}

/**
 * 把字幕文本切分为 token 序列（合并连续空白后按边界切开，过滤空串）。
 *
 * @param text 字幕文本。
 * @returns token 数组。
 */
export function splitWords(text: string): string[] {
    return text
        .replace(/\s+/g, ' ')
        .split(SPLIT_REGEX)
        .filter((token) => token);
}

/**
 * 清洗 token 为生词查询用的小写形态（保留连字符，如 "well-known"）。
 *
 * @param token 切分片段。
 * @returns 清洗后的查询词。
 */
export function cleanWord(token: string): string {
    return token.toLowerCase().replace(/[^\w-]/g, '');
}
