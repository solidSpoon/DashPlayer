import { ApiSettingVO } from '@/common/types/vo/api-setting-vo';

export default interface SettingService {
    // API Settings management
    queryApiSettings(): Promise<ApiSettingVO>;
    updateApiSettings(settings: ApiSettingVO, service?: string): Promise<void>;
    
    // Service provider queries
    getCurrentSentenceLearningProvider(): Promise<'openai' | null>;
    getCurrentTranslationProvider(): Promise<'openai' | 'tencent' | null>;
    getCurrentTranscriptionProvider(): Promise<'openai' | 'whisper' | null>;
    getOpenAiSubtitleTranslationMode(): Promise<'zh' | 'simple_en' | 'custom'>;
    getOpenAiSubtitleCustomStyle(): Promise<string>;
    getCurrentDictionaryProvider(): Promise<'openai' | 'youdao' | null>;
    
    // Test service connections
    testOpenAi(): Promise<{ success: boolean, message: string }>;
    testTencent(): Promise<{ success: boolean, message: string }>;
    testYoudao(): Promise<{ success: boolean, message: string }>;
}
