import path from 'path';
import { storeGet, storeSet } from '@/backend/store';
import { app } from 'electron';
import StrUtil from '@/common/utils/str-util';
export enum LocationType {
    FAVORITE_CLIPS = 'favorite_clips',
    TEMP = 'temp',
    LOGS = 'logs',
    VIDEOS = 'videos',
}
export default class LocationService {
    private static readonly isDev = process.env.NODE_ENV === 'development';

    public static ffmpegPath() {
        return this.isDev ? path.resolve('lib/ffmpeg') : `${process.resourcesPath}/lib/ffmpeg`;
    }

    public static ffprobePath() {
        return this.isDev ? path.resolve('lib/ffprobe') : `${process.resourcesPath}/lib/ffprobe`;
    }

    public static ytDlPath() {
        return this.isDev ? path.resolve('lib/yt-dlp') : `${process.resourcesPath}/lib/yt-dlp`;
    }

    public static libPath() {
        return this.isDev ? path.resolve('lib') : `${process.resourcesPath}/lib`;
    }

    public static scriptPath() {
        return this.isDev ? path.resolve('scripts') : `${process.resourcesPath}/scripts`;
    }

    public static getStoragePath(type: LocationType) {
        const basePath = this.getStorageBathPath();
        return path.join(basePath, type);
    }

    private static getStorageBathPath() {
        const p = storeGet('storage.path');
        if (StrUtil.isBlank(p)) {
            const documentsPath = app.getPath('documents');
            const storagePath = path.join(documentsPath, 'DashPlayer');
            storeSet('storage.path', storagePath);
            return storagePath;
        }
        return p;
    }
}
