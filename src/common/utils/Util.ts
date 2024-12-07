import {DpTask, DpTaskState} from "@/backend/db/tables/dpTask";


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
    public static trim(str: string | null | undefined): string {
        return (str ?? '').trim();
    }
    public static cmpTaskState(task:DpTask, status:(DpTaskState|'none')[]):boolean {
        const taskStatus = task?.status;
        if (taskStatus === undefined || taskStatus === null) {
            return status.includes('none');
        }
        return status.map(s => s.toString()).includes(taskStatus.toString());
    }
}

export const emptyFunc = () => {
    return;
}
