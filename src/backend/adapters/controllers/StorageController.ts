import registerRoute from '@/backend/adapters/ipc/registerRoute';
import Controller from '@/backend/adapters/controllers/Controller';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import FileUtil from '@/backend/utils/FileUtil';
import { StorageStatusVO } from '@/common/types/vo/StorageStatusVO';
import StorageDirectoryProvider, {
    StorageDirectoryTarget,
} from '@/backend/application/ports/gateways/storage/StorageDirectoryProvider';
import { getStorageRootStatus } from '@/backend/infrastructure/storage/StorageDirectorySupport';
import { SettingsStore } from '@/backend/application/ports/gateways/SettingsStore';

@injectable()
export default class StorageController implements Controller {
    @inject(TYPES.SettingsStore) private settingsStore!: SettingsStore;
    @inject(TYPES.StorageDirectoryProvider) private storageDirectoryProvider!: StorageDirectoryProvider;

    /**
     * 查询媒体库目录占用空间。
     *
     * 行为说明：
     * - 仅在媒体库可访问时才执行目录遍历；
     * - 目录失效时直接抛出显式错误，避免误报为 0 KB。
     */
    public async queryCacheSize(): Promise<string> {
        const libraryRoot = await this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.LIBRARY_ROOT);
        return await FileUtil.calculateReadableFolderSize(libraryRoot);
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
