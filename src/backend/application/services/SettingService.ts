import { FeatureServiceRoutingVO } from '@/common/types/vo/feature-service-routing-vo';
import { ServiceCredentialsVO } from '@/common/types/vo/service-credentials-vo';

export default interface SettingService {
    // v2 settings
    getCredentials(): Promise<ServiceCredentialsVO>;
    updateCredentials(patch: Partial<ServiceCredentialsVO>): Promise<void>;
    getFeatureRouting(): Promise<FeatureServiceRoutingVO>;
    updateFeatureRouting(patch: Partial<FeatureServiceRoutingVO>): Promise<void>;

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
