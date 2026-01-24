import { AiProviderConfig, SettingKey } from '@/common/types/store_schema';
import registerRoute from '@/common/api/register';
import Controller from '@/backend/interfaces/controller';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import SettingService from '@/backend/services/SettingService';
import LocationService from '@/backend/services/LocationService';
import FileUtil from '@/backend/utils/FileUtil';

@injectable()
export default class StorageController implements Controller {
    @inject(TYPES.SettingService) private settingService!: SettingService;
    @inject(TYPES.LocationService) private locationService!: LocationService;

    public async storeSet({ key, value }: { key: SettingKey, value: string }): Promise<void> {
        await this.settingService.set(key, value);
    }

    public async storeGet(key: SettingKey): Promise<string> {
        return this.settingService.get(key);
    }

    public async queryCacheSize(): Promise<string> {
        return await FileUtil.calculateReadableFolderSize(this.locationService.getBaseLibraryPath());
    }

    public async listCollectionPaths(): Promise<string[]> {
        return this.locationService.listCollectionPaths();
    }

    public async getAiProviderConfigs(): Promise<AiProviderConfig[]> {
        return this.settingService.getAiProviderConfigs();
    }

    public async addAiProviderConfig(config: AiProviderConfig): Promise<AiProviderConfig[]> {
        return this.settingService.addAiProviderConfig(config);
    }

    public async updateAiProviderConfig(config: AiProviderConfig): Promise<AiProviderConfig[]> {
        return this.settingService.updateAiProviderConfig(config);
    }

    public async deleteAiProviderConfig(id: string): Promise<AiProviderConfig[]> {
        return this.settingService.deleteAiProviderConfig(id);
    }

    public async setActiveAiProvider(id: string): Promise<void> {
        return this.settingService.setActiveAiProvider(id);
    }

    public async getActiveAiProvider(): Promise<string | null> {
        return this.settingService.getActiveAiProvider();
    }

    public async updateAllAiProviderConfigs(configs: AiProviderConfig[]): Promise<void> {
        return this.settingService.updateAllAiProviderConfigs(configs);
    }

    registerRoutes(): void {
        registerRoute('storage/put', (p) => this.storeSet(p));
        registerRoute('storage/get', (p) => this.storeGet(p));
        registerRoute('storage/cache/size', (p) => this.queryCacheSize());
        registerRoute('storage/collection/paths', () => this.listCollectionPaths());
        registerRoute('setting/ai-providers/get', () => this.getAiProviderConfigs());
        registerRoute('setting/ai-providers/add', (p) => this.addAiProviderConfig(p));
        registerRoute('setting/ai-providers/update', (p) => this.updateAiProviderConfig(p));
        registerRoute('setting/ai-providers/delete', (p) => this.deleteAiProviderConfig(p));
        registerRoute('setting/ai-providers/set-active', (p) => this.setActiveAiProvider(p));
        registerRoute('setting/ai-providers/get-active', () => this.getActiveAiProvider());
        registerRoute('setting/ai-providers/update-all', (p) => this.updateAllAiProviderConfigs(p));
    }
}
