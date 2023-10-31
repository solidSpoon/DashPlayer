import clsx, { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const strBlank = (str: string | undefined): boolean => {
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
