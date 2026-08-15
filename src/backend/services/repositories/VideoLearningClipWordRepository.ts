export default interface VideoLearningClipWordRepository {
    findClipKeysByWord(word: string): Promise<string[]>;
    getWordsMapByClipKeys(keys: string[]): Promise<Map<string, string[]>>;
    countGroupedByWord(): Promise<Record<string, number>>;
}
