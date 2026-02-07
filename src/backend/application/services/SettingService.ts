import { ServiceCredentialSettingVO } from '@/common/types/vo/service-credentials-setting-vo';
import { EngineSelectionSettingVO } from '@/common/types/vo/engine-selection-setting-vo';

export default interface SettingService {
    queryServiceCredentials(): Promise<ServiceCredentialSettingVO>;
    updateServiceCredentials(settings: ServiceCredentialSettingVO): Promise<void>;
    queryEngineSelection(): Promise<EngineSelectionSettingVO>;
    updateEngineSelection(settings: EngineSelectionSettingVO): Promise<void>;
    migrateProviderSettings(): Promise<void>;
    
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
