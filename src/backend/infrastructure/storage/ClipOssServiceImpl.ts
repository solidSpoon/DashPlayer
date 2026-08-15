import AbstractOssServiceImpl from '@/backend/infrastructure/storage/AbstractOssServiceImpl';
import { ClipMeta, ClipVersion, OssBaseMeta } from '@/common/types/clipMeta';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import { ClipOssService } from '@/backend/application/services/OssService';
import path from 'path';
import FfmpegService from '@/backend/application/services/FfmpegService';
import fs from 'fs';
import { MetaDataSchemaV1 } from '@/common/types/clipMeta/ClipMetaDataV1';
import { OssBaseSchema } from '@/common/types/clipMeta/base';
import StorageDirectoryProvider, {
    StorageDirectoryTarget,
} from '@/backend/application/ports/gateways/storage/StorageDirectoryProvider';

@injectable()
export default class ClipOssServiceImpl extends AbstractOssServiceImpl<ClipMeta> implements ClipOssService {
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
        return this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.FAVORITE_CLIPS_COLLECTION);
    }

    /**
     * 解析收藏片段元数据。
     * @param metadata 原始元数据。
     * @returns 校验通过后的结构化元数据。
     */
    parseMetadata(metadata: unknown): (OssBaseMeta & ClipMeta) | null {
        const version = typeof metadata === 'object' && metadata !== null
            ? (metadata as { version?: unknown }).version
            : undefined;
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

    /**
     * 校验待写入的新元数据是否合法。
     * @param metadata 候选元数据。
     * @returns 是否满足当前版本约束。
     */
    verifyNewMetadata(metadata: unknown): boolean {
        const version = typeof metadata === 'object' && metadata !== null
            ? (metadata as { version?: unknown }).version
            : undefined;
        if (this.getVersion() !== version) {
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
            time: length / 2,
            inputDuration: length
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
