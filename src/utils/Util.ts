import clsx, { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const strBlank = (str: string): boolean => {
    return !str || str.trim() === '';
};
export const sleep = (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
