import AbstractOssServiceImpl from '@/backend/infrastructure/storage/AbstractOssServiceImpl';
import { ClipMeta, ClipVersion, OssBaseMeta } from '@/common/types/clipMeta';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import { ClipOssService } from '@/backend/services/OssService';
import path from 'path';
import FfmpegService from '@/backend/services/FfmpegService';
import fs from 'fs';
import { MetaDataSchemaV1 } from '@/common/types/clipMeta/ClipMetaDataV1';
import { OssBaseSchema } from '@/common/types/clipMeta/base';
import StorageDirectoryProvider, {
    StorageDirectoryTarget,
} from '@/backend/services/gateways/storage/StorageDirectoryProvider';

@injectable()
export default class VideoLearningOssServiceImpl extends AbstractOssServiceImpl<ClipMeta> implements ClipOssService {
    @inject(TYPES.StorageDirectoryProvider)
    private storageDirectoryProvider!: StorageDirectoryProvider;

    @inject(TYPES.FfmpegService)
    private ffmpegService!: FfmpegService;

    private readonly CLIP_FILE = 'clip.mp4';
    private readonly THUMBNAIL_FILE = 'thumbnail.jpg';

    getVersion(): number {
        return ClipVersion;
    }

    async getBasePath(): Promise<string> {
        return this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.WORD_VIDEO);
    }

    parseMetadata(metadata: unknown): (OssBaseMeta & ClipMeta) | null {
        const version = (metadata as { version?: unknown } | null)?.version;
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

    verifyNewMetadata(metadata: unknown): boolean {
        if (this.getVersion() !== (metadata as { version?: unknown } | null)?.version) {
            return false;
        }
        return MetaDataSchemaV1.merge(OssBaseSchema).safeParse(metadata).success;
    }

    async putClip(key: string, sourcePath: string, metadata: ClipMeta): Promise<void> {
        const tempFolder = await this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.TEMP);
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
