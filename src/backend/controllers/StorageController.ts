import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { SettingKey } from '@/common/types/store_schema';
import registerRoute from '@/common/api/register';
import Controller from '@/backend/interfaces/controller';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import SettingService from '@/backend/services/SettingService';

export const BASE_PATH = path.join(app.getPath('userData'), 'useradd');
const formatBytes = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']; // 文件大小单位
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
};
/**
 * 查询缓存大小
 */
export const queryCacheSize = async () => {
    const filePaths: string[] = [];
    filePaths.push(
        path.join(
            app?.getPath?.('userData') ?? __dirname,
            'useradd',
            'dp_db.sqlite3'
        )
    );
    const promises = filePaths
        .filter((p) => fs.existsSync(p))
        .map((filePath) => fs.promises.stat(filePath));
    const stats = await Promise.all(promises);
    const size = stats.reduce((acc, stat) => acc + stat.size, 0);
    return formatBytes(size);
};

@injectable()
export default class StorageController implements Controller {
    @inject(TYPES.SettingService) private settingService!: SettingService;

    public async storeSet({ key, value }: { key: SettingKey, value: string }): Promise<void> {
        await this.settingService.set(key, value);
    }

    public async storeGet(key: SettingKey): Promise<string> {
        return this.settingService.get(key);
    }

    public async queryCacheSize(): Promise<string> {
        return queryCacheSize();
    }

    registerRoutes(): void {
        registerRoute('storage/put', (p) => this.storeSet(p));
        registerRoute('storage/get', (p) => this.storeGet(p));
        registerRoute('storage/cache/size', (p) => this.queryCacheSize());
    }
}
