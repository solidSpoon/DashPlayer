import { LocationType } from '@/backend/application/services/LocationService';
import path from 'path';
import StrUtil from '@/common/utils/str-util';
import {storeGet, storeSet} from '@/backend/infrastructure/settings/store';
import { app } from 'electron';
import { getEnvironmentSuffix } from '@/backend/utils/runtimeEnv';

export default class LocationUtil {
    public static staticGetStoragePath(type: LocationType | string) {
        const basePath = this.getStorageBasePath();
        return path.join(basePath, type);
    }

    public static getStorageBasePath() {
        let p = storeGet('storage.path');
        if (StrUtil.isBlank(p)) {
            const documentsPath = app.getPath('documents');
            const folderName = 'DashPlayer';
            p = path.join(documentsPath, folderName);
            storeSet('storage.path', p);
        }

        const dirName = path.basename(p);
        const parentDir = path.dirname(p);

        const baseName = dirName.endsWith('-dev')
            ? dirName.slice(0, -4)
            : dirName;
        const finalName = `${baseName}${getEnvironmentSuffix()}`;

        if (finalName !== dirName) {
            return path.join(parentDir, finalName);
        }

        return p;
    }

}
