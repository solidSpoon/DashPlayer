import path from 'path';
import LocationService, { LocationType, ProgramType } from '@/backend/application/services/LocationService';
import { injectable } from 'inversify';

import LocationUtil from '@/backend/utils/LocationUtil';
import { getRuntimeResourcePath } from '@/backend/utils/runtimeEnv';

const DEFAULT_COLLECTION = 'default';

@injectable()
export default class LocationServiceImpl implements LocationService {
    /**
     * 获取指定存储类型的绝对目录。
     * @param type 存储类型。
     * @returns 对应目录路径。
     */
    getDetailLibraryPath(type: LocationType): string {
        return LocationUtil.staticGetStoragePath(type);
    }

    /**
     * 获取存储根目录。
     * @returns 存储根目录路径。
     */
    getBaseLibraryPath(): string {
        return LocationUtil.getStorageBasePath();
    }

    /**
     * 获取收藏片段目录。
     *
     * 约束说明：收藏集合固定为 `default`，避免与 `word_video` 等系统目录混用。
     * @returns 收藏片段目录路径。
     */
    getBaseClipPath(): string {
        const p = LocationUtil.staticGetStoragePath(LocationType.FAVORITE_CLIPS);
        return path.join(p, DEFAULT_COLLECTION);
    }

    /**
     * 获取第三方二进制工具路径。
     * @param type 工具类型。
     * @returns 对应工具路径，不存在则返回空字符串。
     */
    getThirdLibPath(type: ProgramType): string {
        switch (type) {
            case ProgramType.FFMPEG:
                return getRuntimeResourcePath('lib', 'ffmpeg');
            case ProgramType.FFPROBE:
                return getRuntimeResourcePath('lib', 'ffprobe');
            case ProgramType.LIB:
                return getRuntimeResourcePath('lib');
            default:
                return '';
        }
    }

    /**
     * 列出可切换的收藏集合。
     *
     * 当前策略：仅允许 `default`，前后端一致固定集合，降低误删风险。
     * @returns 固定集合列表。
     */
    listCollectionPaths(): string[] {
        return [DEFAULT_COLLECTION];
    }

}
