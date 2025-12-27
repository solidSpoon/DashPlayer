import {SettingKey} from '@/common/types/store_schema';
import registerRoute from '@/backend/adapters/ipc/registerRoute';
import Controller from '@/backend/interfaces/controller';
import {inject, injectable} from 'inversify';
import TYPES from '@/backend/ioc/types';
import SettingService from '@/backend/services/SettingService';
import LocationService from '@/backend/services/LocationService';
import FileUtil from '@/backend/utils/FileUtil';
import SystemService from '@/backend/services/SystemService';
import {getMainLogger} from '@/backend/ioc/simple-logger';

@injectable()
export default class StorageController implements Controller {
    @inject(TYPES.SettingService) private settingService!: SettingService;
    @inject(TYPES.LocationService) private locationService!: LocationService;
        @inject(TYPES.SystemService) private systemService!: SystemService;
    private logger = getMainLogger('StorageController');

    public async storeSet({key, value}: { key: SettingKey, value: string }): Promise<void> {
        this.logger.debug('store setting', {key, value});
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
