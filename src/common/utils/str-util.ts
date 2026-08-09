export default class StrUtil {
    // Type predicate: Returns true if `str` is null, undefined, or only whitespace
    public static isBlank(str: string | undefined | null): str is undefined | null | '' {
        return str === undefined || str === null || str.trim() === '';
    }

    // Type predicate: Returns true if `str` is a non-blank string
    public static isNotBlank(str: string | undefined | null): str is string {
        return !StrUtil.isBlank(str);
    }

    public static allBlank(...strs: (string | undefined | null)[]): boolean {
        return strs.every(this.isBlank);
    }

    public static ifBlank(str: string | undefined | null, defaultStr: string): string {
        return StrUtil.isBlank(str) ? defaultStr : str!;
    }

    /**
     * Checks if at least one string is non-blank.
     *
     * @param {...(string | undefined | null)[]} strs - Strings to check
     * @returns {boolean} - True if any string is non-blank
     */
    public static hasNonBlank(...strs: (string | undefined | null)[]): boolean {
        return strs.some(StrUtil.isNotBlank);
    }

    public static hasBlank(...strs: (string | undefined | null)[]): boolean {
        return strs.some(StrUtil.isBlank);
    }

    /**
     * 生成日志用单行预览：折叠空白并截断，避免长文本撑爆日志行。
     * @param str 原始文本。
     * @param maxLen 最大保留长度，默认 60。
     * @returns 单行预览文本（超长时以 … 结尾）。
     */
    public static preview(str: string, maxLen = 60): string {
        const single = str.replace(/\s+/g, ' ').trim();
        return single.length > maxLen ? `${single.slice(0, maxLen)}…` : single;
    }
}
