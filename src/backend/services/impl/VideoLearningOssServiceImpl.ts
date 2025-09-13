import AbstractOssServiceImpl from '@/backend/services/impl/AbstractOssServiceImpl';
import { ClipMeta, ClipVersion, OssBaseMeta } from '@/common/types/clipMeta';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import LocationService, { LocationType } from '@/backend/services/LocationService';
import { ClipOssService } from '@/backend/services/OssService';
import path from 'path';
import FfmpegServiceImpl from '@/backend/services/impl/FfmpegServiceImpl';
import fs from 'fs';
import { MetaDataSchemaV1 } from '@/common/types/clipMeta/ClipMetaDataV1';
import { OssBaseSchema } from '@/common/types/clipMeta/base';

@injectable()
export default class VideoLearningOssServiceImpl extends AbstractOssServiceImpl<ClipMeta> implements ClipOssService {
    @inject(TYPES.LocationService)
    private locationService!: LocationService;

    @inject(TYPES.FfmpegService)
    private ffmpegService!: FfmpegServiceImpl;

    private readonly CLIP_FILE = 'clip.mp4';
    private readonly THUMBNAIL_FILE = 'thumbnail.jpg';

    getVersion(): number {
        return ClipVersion;
    }

    getBasePath(): string {
        const favoriteClipsPath = this.locationService.getDetailLibraryPath(LocationType.FAVORITE_CLIPS);
        return path.join(favoriteClipsPath, 'word_video');
    }

    parseMetadata(metadata: any): (OssBaseMeta & ClipMeta) | null {
        const version = metadata?.version;
        if (!version) {
            return null;
        }
        if (version === 1) {
            const safeParse = MetaDataSchemaV1.merge(OssBaseSchema).safeParse(metadata);
            if (safeParse.success) {
                return safeParse.data;
            }
        }
        return null;
    }

    verifyNewMetadata(metadata: any): boolean {
        if (this.getVersion() !== metadata?.version) {
            return false;
        }
        return MetaDataSchemaV1.merge(OssBaseSchema).safeParse(metadata).success;
    }

    async putClip(key: string, sourcePath: string, metadata: ClipMeta): Promise<void> {
        const tempFolder = this.locationService.getDetailLibraryPath(LocationType.TEMP);
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