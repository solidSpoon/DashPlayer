import registerRoute from '@/backend/controllers/ipc/registerRoute';
import Controller from '@/backend/controllers/Controller';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import { StorageStatusVO } from '@/common/types/vo/StorageStatusVO';
import {
    StorageUsageItemVO,
    StorageUsageVO,
} from '@/common/contracts/storage-usage-vo';
import StorageDirectoryProvider, {
    StorageDirectoryTarget,
} from '@/backend/services/gateways/storage/StorageDirectoryProvider';
import FileSystemGateway from '@/backend/services/gateways/storage/FileSystemGateway';
import {
    getStorageRootStatus,
    resolveStorageDirectory,
} from '@/backend/infrastructure/storage/StorageDirectorySupport';
import { SettingsStore } from '@/backend/services/gateways/SettingsStore';

@injectable()
export default class StorageController implements Controller {
    @inject(TYPES.SettingsStore) private settingsStore!: SettingsStore;
    @inject(TYPES.StorageDirectoryProvider) private storageDirectoryProvider!: StorageDirectoryProvider;
    @inject(TYPES.FileSystemGateway) private fileSystemGateway!: FileSystemGateway;

    /**
     * 查询媒体库存储用量明细。
     *
     * 行为说明：
     * - 仅在媒体库可访问时才执行目录遍历，目录失效时抛出显式错误；
     * - 固定子目录（videos、models 等）尚未创建时按 0 统计，不视为异常；
     * - 未纳入固定分类的文件统一归入 `other` 分类。
     */
    public async queryStorageUsage(): Promise<StorageUsageVO> {
        const libraryRoot = await this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.LIBRARY_ROOT);
        const totalBytes = await this.fileSystemGateway.getDirectorySize(libraryRoot);

        const videosBytes = await this.queryDirectoryUsage(libraryRoot, StorageDirectoryTarget.VIDEOS);
        const favouriteClipsBytes = await this.queryDirectoryUsage(libraryRoot, StorageDirectoryTarget.FAVORITE_CLIPS);
        const wordClipsBytes = await this.queryDirectoryUsage(libraryRoot, StorageDirectoryTarget.WORD_VIDEO);
        const tempBytes = (await this.queryDirectoryUsage(libraryRoot, StorageDirectoryTarget.TEMP))
            + (await this.queryDirectoryUsage(libraryRoot, StorageDirectoryTarget.TEMP_OSS));
        const modelsBytes = await this.queryDirectoryUsage(libraryRoot, StorageDirectoryTarget.MODELS);

        // word_video 位于 favorite_clips 内，收藏片段分类只保留其余部分；
        // 目录内容在两次遍历之间可能变化，差值为负时按 0 展示。
        const favouriteClipsOnlyBytes = Math.max(favouriteClipsBytes - wordClipsBytes, 0);
        const otherBytes = Math.max(
            totalBytes - videosBytes - favouriteClipsOnlyBytes - wordClipsBytes - tempBytes - modelsBytes,
            0,
        );

        const knownItems: StorageUsageItemVO[] = [
            { category: 'videos', bytes: videosBytes },
            { category: 'favorite_clips', bytes: favouriteClipsOnlyBytes },
            { category: 'word_clips', bytes: wordClipsBytes },
            { category: 'models', bytes: modelsBytes },
            { category: 'temp', bytes: tempBytes },
            { category: 'other', bytes: otherBytes },
        ];
        const items = knownItems
            .filter((item) => item.bytes > 0)
            .sort((a, b) => b.bytes - a.bytes);

        return { totalBytes, items };
    }

    /**
     * 统计指定目标目录的占用大小；目录尚未创建时返回 0。
     * @param libraryRoot 已确认可访问的媒体库根目录。
     * @param target 目录目标。
     * @returns 目录占用大小，单位字节。
     */
    private async queryDirectoryUsage(libraryRoot: string, target: StorageDirectoryTarget): Promise<number> {
        return this.fileSystemGateway.getDirectorySizeIfExists(resolveStorageDirectory(libraryRoot, target));
    }

    /**
     * 返回当前媒体库目录健康状态。
     * @returns 可供设置页直接展示的状态信息。
     */
    public async queryStorageStatus(): Promise<StorageStatusVO> {
        return await getStorageRootStatus(this.settingsStore.get('storage.path'));
    }

    /**
     * 列出可切换的收藏集合。
     * @returns 当前支持的集合列表。
     */
    public async listCollectionPaths(): Promise<string[]> {
        return ['default'];
    }


    registerRoutes(): void {
        registerRoute('storage/usage', () => this.queryStorageUsage());
        registerRoute('storage/status', () => this.queryStorageStatus());
        registerRoute('storage/collection/paths', () => this.listCollectionPaths());
    }
}
