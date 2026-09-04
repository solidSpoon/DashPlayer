import AbstractOssServiceImpl from '@/backend/infrastructure/storage/AbstractOssServiceImpl';
import { ClipMeta, ClipVersion, OssBaseMeta } from '@/common/types/clipMeta';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import { ClipOssService } from '@/backend/services/OssService';
import path from 'path';
import FfmpegService from '@/backend/services/FfmpegService';
import { MetaDataSchemaV1 } from '@/common/types/clipMeta/ClipMetaDataV1';
import { OssBaseSchema } from '@/common/types/clipMeta/base';
import FileSystemGateway from '@/backend/services/gateways/storage/FileSystemGateway';
import StorageDirectoryProvider, {
    StorageDirectoryTarget,
} from '@/backend/services/gateways/storage/StorageDirectoryProvider';

@injectable()
export default class VideoLearningOssServiceImpl extends AbstractOssServiceImpl<ClipMeta> implements ClipOssService {
    private readonly storageDirectoryProvider: StorageDirectoryProvider;
    private readonly ffmpegService: FfmpegService;

    private readonly CLIP_FILE = 'clip.mp4';
    private readonly THUMBNAIL_FILE = 'thumbnail.jpg';

    constructor(
        @inject(TYPES.FileSystemGateway) fileSystemGateway: FileSystemGateway,
        @inject(TYPES.StorageDirectoryProvider) storageDirectoryProvider: StorageDirectoryProvider,
        @inject(TYPES.FfmpegService) ffmpegService: FfmpegService,
    ) {
        super(fileSystemGateway);
        this.storageDirectoryProvider = storageDirectoryProvider;
        this.ffmpegService = ffmpegService;
    }

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

    /**
     * 写入一条单词视频片段：生成缩略图、复制片段文件并落元数据。
     *
     * 行为说明：
     * - 临时缩略图在 finally 中清理，写入中途失败也不会遗留在 temp 目录。
     *
     * @param key 片段 key。
     * @param sourcePath 待写入的临时片段文件绝对路径。
     * @param metadata 片段业务元数据。
     */
    async putClip(key: string, sourcePath: string, metadata: ClipMeta): Promise<void> {
        const tempFolder = await this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.TEMP);
        // 生成缩略图
        const thumbnailFileName = `${key}-${this.THUMBNAIL_FILE}`;
        const tempThumbnailPath = path.join(tempFolder, thumbnailFileName);
        try {
            const length = await this.ffmpegService.duration(sourcePath);
            await this.ffmpegService.thumbnail({
                inputFile: sourcePath,
                outputFileName: thumbnailFileName,
                outputFolder: tempFolder,
                time: length / 2
            });
            await this.putFile(key, this.THUMBNAIL_FILE, tempThumbnailPath);
            await this.putFile(key, this.CLIP_FILE, sourcePath);
            await this.updateMetadata(key, {
                ...metadata,
                clip_file: this.CLIP_FILE,
                thumbnail_file: this.THUMBNAIL_FILE
            });
        } finally {
            await this.fileSystemGateway.removeFileIfExists(tempThumbnailPath);
        }
    }

    async updateTags(key: string, tags: string[]): Promise<void> {
        await this.updateMetadata(key, { tags: tags });
    }
}
