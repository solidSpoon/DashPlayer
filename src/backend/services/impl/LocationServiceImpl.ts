import path from 'path';
import {storeGet} from '@/backend/infrastructure/settings/store';
import StrUtil from '@/common/utils/str-util';
import LocationService, { LocationType, ProgramType } from '@/backend/services/LocationService';
import { injectable } from 'inversify';

import fs from 'fs';
import LocationUtil from '@/backend/utils/LocationUtil';

@injectable()
export default class LocationServiceImpl implements LocationService {
    private static readonly isDev = process.env.NODE_ENV === 'development';

    getDetailLibraryPath(type: LocationType): string {
        return LocationUtil.staticGetStoragePath(type);
    }

    getBaseLibraryPath(): string {
        return LocationUtil.getStorageBathPath();
    }

    getBaseClipPath(): string {
        const p = LocationUtil.staticGetStoragePath(LocationType.FAVORITE_CLIPS);
        return path.join(p, StrUtil.ifBlank(storeGet('storage.collection'), 'default'));
    }

    getThirdLibPath(type: ProgramType): string {
        switch (type) {
            case ProgramType.FFMPEG:
                return LocationServiceImpl.isDev ? path.resolve('lib/ffmpeg') : `${process.resourcesPath}/lib/ffmpeg`;
            case ProgramType.FFPROBE:
                return LocationServiceImpl.isDev ? path.resolve('lib/ffprobe') : `${process.resourcesPath}/lib/ffprobe`;
            case ProgramType.LIB:
                return LocationServiceImpl.isDev ? path.resolve('lib') : `${process.resourcesPath}/lib`;
            default:
                return '';
        }
    }

    listCollectionPaths(): string[] {
        const storagePath = this.getDetailLibraryPath(LocationType.FAVORITE_CLIPS);
        const folders: string[] = [];
        if (fs.existsSync(storagePath)) {
            folders.push(...fs.readdirSync(storagePath).filter(name => !name.startsWith('.')));
        }
        const current = storeGet('storage.collection');
        if (StrUtil.isNotBlank(current) && !folders.includes(current)) {
            folders.unshift(current);
        }
        return folders;
    }

}
