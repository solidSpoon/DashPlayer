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


    private generateThumbnailPath(sourceFilePath: string, timestamp: number): string {
        const thumbnailFileName = ObjUtil.hash(sourceFilePath) + '-' + timestamp + '.jpg';
        return path.join(this.locationService.getDetailLibraryPath(LocationType.TEMP), thumbnailFileName);
    }

    private getTempDirectoryPath() {
        return this.locationService.getDetailLibraryPath(LocationType.TEMP);
    }

    async thumbnail(sourceFilePath: string, timestamp?: number): Promise<string> {
        if (!fs.existsSync(sourceFilePath)) {
            return '';
        }
        const duration = await this.ffmpegService.duration(sourceFilePath);
        const adjustedTimestamp = this.calculateAdjustedTimestamp(timestamp, duration);
        const tempDirectoryPath = this.getTempDirectoryPath();
        const thumbnailPath = this.generateThumbnailPath(sourceFilePath, adjustedTimestamp);

        if (fs.existsSync(thumbnailPath)) {
            return thumbnailPath;
        }

        await this.ffmpegService.thumbnail({
            inputFile: sourceFilePath,
            outputFolder: tempDirectoryPath,
            outputFileName: path.basename(thumbnailPath),
            time: adjustedTimestamp
        });

        return thumbnailPath;
    }

    private calculateAdjustedTimestamp(timestamp: number | undefined, duration: number) {
        let adjustedTimestamp = timestamp ? timestamp : duration / 2;
        adjustedTimestamp = Math.min(Math.max(adjustedTimestamp, 0), duration);
        return Math.floor(adjustedTimestamp / 15);
    }

    async duration(inputFile: string): Promise<number> {
        if (!fs.existsSync(inputFile)) {
            return 0;
        }
        return this.ffmpegService.duration(inputFile);
    }
}

