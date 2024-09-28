export default class StrUtil {
    // Type predicate: Returns true if `str` is null, undefined, or only whitespace
    public static isBlank(str: string | undefined | null): str is null | undefined | '' {
        return !str || str.trim() === '';
    }

    // Type predicate: Returns true if `str` is a non-blank string
    public static isNotBlank(str: string | undefined | null): str is string {
        return !this.isBlank(str);
    }

    public static allBlank(...strs: (string | undefined | null)[]): boolean {
        return strs.every(this.isBlank);
    }

    /**
     * Checks if at least one string is non-blank.
     *
     * @param {...(string | undefined | null)[]} strs - Strings to check
     * @returns {boolean} - True if any string is non-blank
     */
    public static hasNonBlank(...strs: (string | undefined | null)[]): boolean {
        return strs.some(this.isNotBlank);
    }
}
