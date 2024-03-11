import clsx, { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const strBlank = (str: string | undefined | null): boolean => {
    return !str || str.trim() === '';
};
export const sleep = (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
const isWord = (str: string): boolean => {
    const noWordRegex = /[^A-Za-z0-9-]/;
    return !noWordRegex.test(str);
};
export function splitToWords(text: string | undefined): string[] {
    if (strBlank(text)) return [];
    const SPLIT_REGEX =
        /((?<=.)(?=[^A-Za-z0-9\u4e00-\u9fa5-]))|((?<=[^A-Za-z0-9\u4e00-\u9fa5-])(?=.))/;
    return (text ?? '')
        .replace(/\s+/g, ' ')
        .split(SPLIT_REGEX)
        .filter((w) => w)
        .filter((w) => isWord(w));
}
export function p(str: string | undefined | null): string {
    return (str ?? '').toLowerCase().trim();
}

export const arrayChanged = <T>(a: T[], b: T[]): boolean => {
    if (a.length !== b.length) return true;
    return a.some((item, index) => item !== b[index]);
};
export const secondToDate = (seconds = 0) => {
    if (seconds === undefined) {
        return '00:00:00';
    }
    const h: number = Math.floor((seconds / 60 / 60) % 24);
    const hs = h < 10 ? `0${h}` : h;
    const m = Math.floor((seconds / 60) % 60);
    const ms = m < 10 ? `0${m}` : m;
    const s = Math.floor(seconds % 60);
    const ss = s < 10 ? `0${s}` : s;
    return `${hs}:${ms}:${ss}`;
};
