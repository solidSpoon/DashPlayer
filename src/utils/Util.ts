export const strBlank = (str: string): boolean => {
    return !str || str.trim() === '';
};
export const sleep = (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};
