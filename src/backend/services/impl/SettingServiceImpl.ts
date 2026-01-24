import { AiProviderConfig, SettingKey } from '@/common/types/store_schema';
import { storeGet, storeGetObject, storeSet, storeSetObject } from '../../store';
import SystemService from '@/backend/services/SystemService';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import SettingService from '@/backend/services/SettingService';
import { v4 as uuidv4 } from 'uuid';


@injectable()
export default class SettingServiceImpl implements SettingService {
    @inject(TYPES.SystemService) private systemService!: SystemService;
    public async set(key: SettingKey, value: string): Promise<void> {
        if (storeSet(key, value)) {
            this.systemService.mainWindow()?.webContents.send('store-update', key, value);
        }
    }

    public async get(key: SettingKey): Promise<string> {
        return storeGet(key);
    }

    public async getAiProviderConfigs(): Promise<AiProviderConfig[]> {
        const configs = storeGetObject<AiProviderConfig[] | string>('aiProviderConfigs', []);
        if (typeof configs === 'string') {
            try {
                const parsed = JSON.parse(configs);
                if (Array.isArray(parsed)) {
                    return parsed;
                }
                return [];
            } catch (e) {
                console.error('Error parsing AI provider configs:', e);
                return [];
            }
        }

        if (Array.isArray(configs)) {
            return configs;
        }

        return [];
    }

    public async addAiProviderConfig(config: AiProviderConfig): Promise<AiProviderConfig[]> {
        const configs = await this.getAiProviderConfigs();
        const newConfig = { ...config, id: uuidv4() };
        configs.push(newConfig);
        storeSetObject('aiProviderConfigs', configs);
        return configs;
    }

    public async updateAiProviderConfig(config: AiProviderConfig): Promise<AiProviderConfig[]> {
        const configs = await this.getAiProviderConfigs();
        const index = configs.findIndex(c => c.id === config.id);
        if (index !== -1) {
            configs[index] = config;
            storeSetObject('aiProviderConfigs', configs);
        }
        return configs;
    }

    public async deleteAiProviderConfig(id: string): Promise<AiProviderConfig[]> {
        let configs = await this.getAiProviderConfigs();
        configs = configs.filter(c => c.id !== id);
        storeSetObject('aiProviderConfigs', configs);
        return configs;
    }

    public async setActiveAiProvider(id: string): Promise<void> {
        storeSetObject('activeAiProviderId', id);
    }

    public async getActiveAiProvider(): Promise<string | null> {
        return storeGetObject<string | null>('activeAiProviderId', null);
    }

    public async updateAllAiProviderConfigs(configs: AiProviderConfig[]): Promise<void> {
        storeSetObject('aiProviderConfigs', configs);
    }
}
