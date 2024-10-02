import path from 'path';
import { storeGet } from '@/backend/store';
import StrUtil from '@/common/utils/str-util';
import LocationService, { LocationType, ProgramType } from '@/backend/services/LocationService';
import { injectable } from 'inversify';

import fs from 'fs';
import LocationUtil from '@/backend/utils/LocationUtil';

@injectable()
export default class LocationServiceImpl implements LocationService {
    private static readonly isDev = process.env.NODE_ENV === 'development';

    getStoragePath(type: LocationType): string {
        return LocationUtil.staticGetStoragePath(type)
    }

    getProgramPath(type: ProgramType): string {
        switch (type) {
            case ProgramType.FFMPEG:
                return LocationServiceImpl.isDev ? path.resolve('lib/ffmpeg') : `${process.resourcesPath}/lib/ffmpeg`;
            case ProgramType.FFPROBE:
                return LocationServiceImpl.isDev ? path.resolve('lib/ffprobe') : `${process.resourcesPath}/lib/ffprobe`;
            case ProgramType.YT_DL:
                return LocationServiceImpl.isDev ? path.resolve('lib/yt-dlp') : `${process.resourcesPath}/lib/yt-dlp`;
            case ProgramType.LIB:
                return LocationServiceImpl.isDev ? path.resolve('lib') : `${process.resourcesPath}/lib`;
            default:
                return '';
        }
    }

    listCollectionPaths(): string[] {
        const storagePath = this.getStoragePath(LocationType.FAVORITE_CLIPS);
        if (!fs.existsSync(storagePath)) {
            fs.mkdirSync(storagePath, { recursive: true });
        }
        const strings = fs.readdirSync(storagePath)
            .filter(name => !name.startsWith('.'));
        const current = storeGet('storage.collection');
        if (StrUtil.isNotBlank(current) && !strings.includes(current)) {
            strings.unshift(current);
        }
        return strings;
    }

}
