import AbstractOssServiceImpl from '@/backend/services/impl/AbstractOssServiceImpl';
import { ClipMeta } from '@/common/types/clipMeta';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import LocationService, { LocationType } from '@/backend/services/LocationService';
import { ClipOssService } from '@/backend/services/OssService';
import path from 'path';
import FfmpegServiceImpl from '@/backend/services/impl/FfmpegServiceImpl';
import fs from 'fs';

@injectable()
export default class ClipOssServiceImpl extends AbstractOssServiceImpl<ClipMeta> implements ClipOssService {
    @inject(TYPES.LocationService)
    private locationService!: LocationService;

    @inject(TYPES.FfmpegService)
    private ffmpegService!: FfmpegServiceImpl;

    private readonly CLIP_FILE = 'clip.mp4';
    private readonly THUMBNAIL_FILE = 'thumbnail.jpg';

    getBasePath(): string {
        return this.locationService.getStoragePath(LocationType.FAVORITE_CLIPS);
    }


    async putClip(key: string, sourcePath: string, metadata: MetaData): Promise<void> {
        const tempFolder = this.locationService.getStoragePath(LocationType.TEMP);
        // 生成缩略图
        const thumbnailFileName = `${key}-${this.THUMBNAIL_FILE}`;
        const length = await this.ffmpegService.duration(sourcePath);
        await this.ffmpegService.thumbnail({
            inputFile: sourcePath,
            outputFileName: thumbnailFileName,
            outputFolder: tempFolder,
            time: length / 2
        });
        await this.putFile(key, this.THUMBNAIL_FILE, path.join(tempFolder, thumbnailFileName));
        await this.putFile(key, this.CLIP_FILE, sourcePath);
        await this.updateMetadata(key, {
            ...metadata,
            clip_file: this.CLIP_FILE,
            thumbnail_file: this.THUMBNAIL_FILE
        });
        fs.rmSync(path.join(tempFolder, thumbnailFileName));
    }

    async updateTags(key: string, tags: string[]): Promise<void> {
        await this.updateMetadata(key, { tags: tags });
    }


}
