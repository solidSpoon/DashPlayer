import { SettingKey } from '@/common/types/store_schema';
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


    registerRoutes(): void {
        registerRoute('storage/put', (p) => this.storeSet(p));
        registerRoute('storage/get', (p) => this.storeGet(p));
        registerRoute('storage/cache/size', (p) => this.queryCacheSize());
        registerRoute('storage/collection/paths', () => this.listCollectionPaths());
    }
}
