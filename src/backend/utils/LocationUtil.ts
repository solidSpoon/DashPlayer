import { LocationType } from '@/backend/services/LocationService';
import path from 'path';
import StrUtil from '@/common/utils/str-util';
import { storeGet, storeSet } from '@/backend/store';
import { app } from 'electron';

export default class LocationUtil {
    private static readonly isDev = process.env.NODE_ENV === 'development';

    public static staticGetStoragePath(type: LocationType | string) {
        const basePath = this.getStorageBathPath();
        const p = path.join(basePath, type);
        if (LocationType.FAVORITE_CLIPS === type) {
            return path.join(p, StrUtil.ifBlank(storeGet('storage.collection'), 'default'));
        }
        return p;
    }

    private static getStorageBathPath() {
        let p = storeGet('storage.path');
        if (StrUtil.isBlank(p)) {
            const documentsPath = app.getPath('documents');
            const folderName = 'DashPlayer';
            p = path.join(documentsPath, folderName);
            storeSet('storage.path', p);
        }
        // 如果是开发环境，确保路径末尾有 "dev" 后缀
        // 如果是生产环境，确保路径末尾没有 "dev" 后缀
        const dirName = path.basename(p);
        const parentDir = path.dirname(p);
        let newDirName = dirName;
        if (this.isDev && !dirName.endsWith('-dev')) {
            newDirName += '-dev';
        } else if (!this.isDev && dirName.endsWith('-dev')) {
            newDirName = dirName.slice(0, -3);
        }
        return path.join(parentDir, newDirName);
    }
}
