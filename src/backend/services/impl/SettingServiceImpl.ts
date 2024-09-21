import { SettingKey } from '@/common/types/store_schema';
import { storeGet, storeSet } from '../../store';
import SystemService from '@/backend/services/SystemService';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import SettingService from '@/backend/services/SettingService';



@injectable()
export default class SettingServiceImpl implements SettingService {
    @inject(TYPES.SystemService) private systemService: SystemService;
    public async set(key: SettingKey, value: string): Promise<void> {
        if (storeSet(key, value)) {
            this.systemService.mainWindow()?.webContents.send('store-update', key, value);
        }
    }

    public async get(key: SettingKey): Promise<string> {
        return storeGet(key);
    }
}
