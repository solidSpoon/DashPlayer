export default class StrUtil {
    public static isBlank = (str: string | undefined | null): boolean => {
        return !str || str.trim() === '';
    };
    public static isNotBlank = (str: string | undefined | null): boolean => {
        return !this.isBlank(str);
    };

    /**
     * 检查是否存在非空白字符串
     *
     * @param {...(string | undefined | null)[]} strs - 要检查的字符串数组
     * @returns {boolean} - 如果数组中存在至少一个非空白字符串，则返回 true；否则返回 false
     */
    public static hasNonBlank(...strs: (string | undefined | null)[]): boolean {
        return strs.some(this.isNotBlank);
    }
}
