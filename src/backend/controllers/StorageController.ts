import registerRoute from '@/backend/controllers/ipc/registerRoute';
import Controller from '@/backend/controllers/Controller';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import { StorageStatusVO } from '@/common/types/vo/StorageStatusVO';
import StorageDirectoryProvider, {
    StorageDirectoryTarget,
} from '@/backend/services/gateways/storage/StorageDirectoryProvider';
import FileSystemGateway from '@/backend/services/gateways/storage/FileSystemGateway';
import { getStorageRootStatus } from '@/backend/infrastructure/storage/StorageDirectorySupport';
import { SettingsStore } from '@/backend/services/gateways/SettingsStore';

@injectable()
export default class StorageController implements Controller {
    @inject(TYPES.SettingsStore) private settingsStore!: SettingsStore;
    @inject(TYPES.StorageDirectoryProvider) private storageDirectoryProvider!: StorageDirectoryProvider;
    @inject(TYPES.FileSystemGateway) private fileSystemGateway!: FileSystemGateway;

    /**
     * 查询媒体库目录占用空间。
     *
     * 行为说明：
     * - 仅在媒体库可访问时才执行目录遍历；
     * - 目录失效时直接抛出显式错误，避免误报为 0 KB。
     */
    public async queryCacheSize(): Promise<string> {
        const libraryRoot = await this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.LIBRARY_ROOT);
        const totalBytes = await this.fileSystemGateway.getDirectorySize(libraryRoot);
        return this.formatBytes(totalBytes);
    }

    /**
     * 将字节数转换为设置页使用的可读大小。
     * @param bytes 文件总大小，单位为字节。
     * @returns 带单位的文件大小。
     */
    private formatBytes(bytes: number): string {
        const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        let size = bytes;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex += 1;
        }
        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }

    /**
     * 返回当前媒体库目录健康状态。
     * @returns 可供设置页直接展示的状态信息。
     */
    public async queryStorageStatus(): Promise<StorageStatusVO> {
        return getStorageRootStatus(this.settingsStore.get('storage.path'));
    }

    /**
     * 列出可切换的收藏集合。
     * @returns 当前支持的集合列表。
     */
    public async listCollectionPaths(): Promise<string[]> {
        return ['default'];
    }


    registerRoutes(): void {
        registerRoute('storage/cache/size', () => this.queryCacheSize());
        registerRoute('storage/status', () => this.queryStorageStatus());
        registerRoute('storage/collection/paths', () => this.listCollectionPaths());
    }
}
