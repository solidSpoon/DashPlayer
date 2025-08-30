import { YdRes } from '@/common/types/YdRes';

export default interface TranslateService {
    transWord(str: string): Promise<YdRes | null>;
    transSentences(sentences: string[]): Promise<Map<string, string>>;
    // 新增：获取腾讯客户端，用于直接调用
    getTencentClient(): any;

    groupTranslate(params: {
        engine: 'tencent' | 'openai';
        fileHash: string;
        indices: number[];
        useCache?: boolean;
    }): Promise<void>;
    testTencentTranslation(): Promise<void>;
}

