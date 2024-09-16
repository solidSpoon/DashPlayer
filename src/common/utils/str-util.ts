export default class StrUtil {
    public static isBlank = (str: string | undefined | null): boolean => {
        return !str || str.trim() === '';
    };
    public static isNotBlank = (str: string | undefined | null): boolean => {
        return !this.isBlank(str);
    };
}
