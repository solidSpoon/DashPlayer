import { YdRes, OpenAIDictionaryResult } from '@/common/types/YdRes';

export default interface TranslateService {
    transWord(str: string): Promise<YdRes | OpenAIDictionaryResult | null>;
    transSentences(sentences: string[]): Promise<Map<string, string>>;

    groupTranslate(params: {
        fileHash: string;
        indices: number[];
        useCache?: boolean;
    }): Promise<void>;
}

