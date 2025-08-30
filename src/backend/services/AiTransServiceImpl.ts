import { YdRes } from '@/common/types/YdRes';

export default interface TranslateService {
    transWord(str: string): Promise<YdRes | null>;
    transSentences(sentences: string[]): Promise<Map<string, string>>;

    groupTranslate(params: {
        engine: 'tencent' | 'openai';
        fileHash: string;
        indices: number[];
        useCache?: boolean;
    }): Promise<void>;
}

