import { YdRes } from '@/common/types/YdRes';

export default interface TranslateService {
    transWord(str: string): Promise<YdRes | null>;
    transSentences(sentences: string[]): Promise<Map<string, string>>;
    // 新增：基于key的缓存操作
    getTranslationByKey(key: string): Promise<string | null>;
    saveTranslationByKey(key: string, translation: string): Promise<void>;
    // 新增：获取腾讯客户端，用于直接调用
    getTencentClient(): any;
}

