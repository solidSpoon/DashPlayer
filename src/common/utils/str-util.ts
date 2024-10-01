export default class StrUtil {
    // Type predicate: Returns true if `str` is null, undefined, or only whitespace
    public static isBlank(str: string | undefined | null): str is null | undefined | '' {
        return !str || str.trim() === '';
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
}
