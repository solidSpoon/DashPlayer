import {
    ServiceCredentialSettingDetailVO,
    ServiceCredentialSettingSaveVO,
} from '@/common/types/vo/service-credentials-setting-vo';
import { EngineSelectionSettingVO } from '@/common/types/vo/engine-selection-setting-vo';
import { ShortcutSettingDetailVO, ShortcutSettingSaveVO } from '@/common/types/vo/shortcut-setting-vo';
import { ProxySettingDetailVO, ProxySettingSaveVO } from '@/common/contracts/proxy-setting-vo';
import { AppearanceSettingVO } from '@/common/contracts/appearance-setting-vo';
import { StorageSettingVO } from '@/common/contracts/storage-setting-vo';

export default interface SettingService {
    getServiceCredentialsDetail(): Promise<ServiceCredentialSettingDetailVO>;
    saveServiceCredentials(settings: ServiceCredentialSettingSaveVO): Promise<void>;
    getEngineSelectionDetail(): Promise<EngineSelectionSettingVO>;
    saveEngineSelection(settings: EngineSelectionSettingVO): Promise<void>;
    getShortcutSettingsDetail(): Promise<ShortcutSettingDetailVO>;
    saveShortcutSettings(settings: ShortcutSettingSaveVO): Promise<void>;
    getAppearanceSettingDetail(): Promise<AppearanceSettingVO>;
    saveAppearanceSettings(settings: AppearanceSettingVO): Promise<void>;
    getStorageSettingDetail(): Promise<StorageSettingVO>;
    saveStorageSettings(settings: StorageSettingVO): Promise<void>;
    getProxySettingDetail(): Promise<ProxySettingDetailVO>;
    saveProxySettings(settings: ProxySettingSaveVO): Promise<void>;
    migrateProviderSettings(): Promise<void>;
    
    // Service provider queries
    getCurrentSentenceLearningProvider(): Promise<'openai' | null>;
    getCurrentTranslationProvider(): Promise<'openai' | 'tencent' | null>;
    getOpenAiSubtitleTranslationMode(): Promise<'zh' | 'simple_en' | 'custom'>;
    getOpenAiSubtitleCustomStyle(): Promise<string>;
    getCurrentDictionaryProvider(): Promise<'openai' | 'youdao' | null>;
    
    // Test service connections
    testOpenAi(): Promise<{ success: boolean, message: string }>;
    testTencent(): Promise<{ success: boolean, message: string }>;
    testYoudao(): Promise<{ success: boolean, message: string }>;
}
