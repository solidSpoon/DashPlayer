import { SettingKey } from '@/common/types/store_schema';
import { ApiSettingVO } from '@/common/types/vo/api-setting-vo';

export default interface SettingService {
    set(key: SettingKey, value: string): Promise<void>;
    get(key: SettingKey): Promise<string>;
    
    // API Settings management
    queryApiSettings(): Promise<ApiSettingVO>;
    updateApiSettings(settings: ApiSettingVO): Promise<void>;
    
    // Service provider queries
    getCurrentSentenceLearningProvider(): Promise<'openai' | null>;
    getCurrentTranslationProvider(): Promise<'openai' | 'tencent' | null>;
    getCurrentDictionaryProvider(): Promise<'youdao' | null>;
    
    // Test service connections
    testOpenAi(): Promise<{ success: boolean, message: string }>;
    testTencent(): Promise<{ success: boolean, message: string }>;
    testYoudao(): Promise<{ success: boolean, message: string }>;
}
