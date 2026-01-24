import { AiProviderConfig, SettingKey } from '@/common/types/store_schema';

export default interface SettingService {
    set(key: SettingKey, value: string): Promise<void>;
    get(key: SettingKey): Promise<string>;

    getAiProviderConfigs(): Promise<AiProviderConfig[]>;
    addAiProviderConfig(config: AiProviderConfig): Promise<AiProviderConfig[]>;
    updateAiProviderConfig(config: AiProviderConfig): Promise<AiProviderConfig[]>;
    deleteAiProviderConfig(id: string): Promise<AiProviderConfig[]>;
    setActiveAiProvider(id: string): Promise<void>;
    getActiveAiProvider(): Promise<string | null>;
    updateAllAiProviderConfigs(configs: AiProviderConfig[]): Promise<void>;
}
