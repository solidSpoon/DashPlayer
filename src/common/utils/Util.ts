export const strBlank = (str: string | undefined | null): boolean => {
    return !str || str.trim() === '';
};
export const strNotBlank = (str: string | undefined | null): boolean => {
    return !strBlank(str);
};

/**
 * 只对比英文字符。不区分大小写
 */
export const engEqual = (str1: string, str2: string): boolean => {
    const engRegex = /[A-Za-z]/;
    const engStr1 = (str1 ?? '').split('').filter(c => engRegex.test(c)).join('').toLowerCase();
    const engStr2 = (str2 ?? '').split('').filter(c => engRegex.test(c)).join('').toLowerCase();
    return engStr1 === engStr2;
};

export const sleep = (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};


export function p(str: string | undefined | null): string {
    return (str ?? '').toLowerCase().trim();
}

export const arrayChanged = <T>(a: T[], b: T[]): boolean => {
    if (a.length !== b.length) return true;
    return a.some((item, index) => item !== b[index]);
};

export const joinUrl = (base: string, path: string): string => {
    return base.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, '');
};

export default class Util {
    static strBlank = strBlank;
    static strNotBlank = strNotBlank;
    static engEqual = engEqual;
    static sleep = sleep;
    static p = p;
    static arrayChanged = arrayChanged;
    static joinUrl = joinUrl;
    public static isNull(obj: any): boolean {
        return obj === null || obj === undefined;
    }
    public static isNotNull(obj: any): boolean {
        return !this.isNull(obj);
    }
}
