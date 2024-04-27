import {app, shell} from 'electron';
import fs from 'fs';
import path from 'path';
import Controller from "@/backend/interfaces/controller";
import StorageService from "@/backend/services/StorageService";
import {SettingKey} from "@/common/types/store_schema";
import registerRoute from "@/common/api/register";

export const BASE_PATH = path.join(app.getPath('userData'), 'useradd');
/**
 * 打开数据目录
 */
export const openDataDir = async () => {
    await shell.openPath(BASE_PATH);
};

/**
 * 清理一个月前的缓存
 */
export const clearCache = async () => {
    // await ProgressCache.clearCache();
    // await TranslateCache.clearCache();
    // await WordTransCache.clearCache();
};
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

export default class StorageController implements Controller {
    public async storeSet({key, value}: { key: SettingKey, value: string }): Promise<void> {
        await StorageService.storeSet(key, value);
    }

    public async storeGet(key: SettingKey): Promise<string> {
        return StorageService.storeGet(key);
    }

    public async queryCacheSize(): Promise<string> {
        return queryCacheSize();
    }
    registerRoutes(): void {
        registerRoute('storage/put', this.storeSet);
        registerRoute('storage/get', this.storeGet);
        registerRoute('storage/cache/size', this.queryCacheSize);
    }
}
