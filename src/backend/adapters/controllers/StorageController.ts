import {SettingKey} from '@/common/types/store_schema';
import registerRoute from '@/backend/adapters/ipc/registerRoute';
import Controller from '@/backend/adapters/controllers/Controller';
import {inject, injectable} from 'inversify';
import TYPES from '@/backend/ioc/types';
import LocationService from '@/backend/application/services/LocationService';
import FileUtil from '@/backend/utils/FileUtil';
import {getMainLogger} from '@/backend/infrastructure/logger';
import SettingsKeyValueService from '@/backend/application/services/impl/SettingsKeyValueService';

@injectable()
export default class StorageController implements Controller {
    @inject(TYPES.SettingsKeyValueService) private settingsKeyValueService!: SettingsKeyValueService;
    @inject(TYPES.LocationService) private locationService!: LocationService;
    private logger = getMainLogger('StorageController');

    public async storeSet({key, value}: { key: SettingKey, value: string }): Promise<void> {
        const redactedValue = /(\.apiKey$|\.secretKey$|password|token)/i.test(key) ? '***' : value;
        this.logger.debug('store setting', { key, value: redactedValue });
        await this.settingsKeyValueService.set(key, value);
    }

    public async storeGet(key: SettingKey): Promise<string> {
        return this.settingsKeyValueService.get(key);
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
