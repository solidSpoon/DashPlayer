import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import MediaService from '@/backend/services/MediaService';
import LocationService, { LocationType } from '@/backend/services/LocationService';
import { ObjUtil } from '@/backend/utils/ObjUtil';
import path from 'path';
import FfmpegService from '@/backend/services/FfmpegService';
import fs from 'fs';

@injectable()
export default class MediaServiceImpl implements MediaService {

    @inject(TYPES.LocationService)
    private locationService!: LocationService;

    @inject(TYPES.FfmpegService)
    private ffmpegService!: FfmpegService;


    private generateThumbnailPath(sourceFilePath: string, timestamp: number, options?: {
        quality?: 'low' | 'medium' | 'high' | 'ultra';
        width?: number;
        format?: 'jpg' | 'png';
    }): string {
        const { quality = 'medium', width, format = 'jpg' } = options || {};

        // Create a unique filename based on parameters to avoid caching issues
        const qualitySuffix = quality !== 'medium' ? `-${quality}` : '';
        const widthSuffix = width ? `-w${width}` : '';
        const extension = format === 'png' ? '.png' : '.jpg';

        const thumbnailFileName = ObjUtil.hash(sourceFilePath) + '-' + timestamp + qualitySuffix + widthSuffix + extension;
        return path.join(this.locationService.getDetailLibraryPath(LocationType.TEMP), thumbnailFileName);
    }

    private getTempDirectoryPath() {
        return this.locationService.getDetailLibraryPath(LocationType.TEMP);
    }

    async thumbnail(sourceFilePath: string, timestamp?: number, options?: {
        quality?: 'low' | 'medium' | 'high' | 'ultra';
        width?: number;
        format?: 'jpg' | 'png';
    }): Promise<string> {
        if (!fs.existsSync(sourceFilePath)) {
            return '';
        }
        const duration = await this.ffmpegService.duration(sourceFilePath);
        const adjustedTimestamp = this.calculateAdjustedTimestamp(timestamp, duration);
        const tempDirectoryPath = this.getTempDirectoryPath();
        const thumbnailPath = this.generateThumbnailPath(sourceFilePath, adjustedTimestamp, options);

        if (fs.existsSync(thumbnailPath)) {
            return thumbnailPath;
        }

        await this.ffmpegService.thumbnail({
            inputFile: sourceFilePath,
            outputFolder: tempDirectoryPath,
            outputFileName: path.basename(thumbnailPath),
            time: adjustedTimestamp,
            options: options || {}
        });

        return thumbnailPath;
    }

    private calculateAdjustedTimestamp(timestamp: number | undefined, duration: number) {
        let adjustedTimestamp = timestamp ? timestamp : duration / 2;
        adjustedTimestamp = Math.min(Math.max(adjustedTimestamp, 0), duration);

        // 计算所在的15秒区间索引
        const intervalIndex = Math.floor(adjustedTimestamp / 15);

        // 计算区间中间值：区间起始点 + 7秒 (整数)
        const intervalMiddle = intervalIndex * 15 + 7;

        // 确保不超过duration范围，并且留出1秒的缓冲
        return Math.min(intervalMiddle, Math.floor(duration) - 1);
    }


    async duration(inputFile: string): Promise<number> {
        if (!fs.existsSync(inputFile)) {
            return 0;
        }
        return this.ffmpegService.duration(inputFile);
    }
}

