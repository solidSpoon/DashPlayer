export interface YouDaoDictionaryClient {
    translate(word: string): Promise<string | null>;
}

