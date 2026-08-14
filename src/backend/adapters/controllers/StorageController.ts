import { SettingKey } from '@/common/types/store_schema';
import registerRoute from '@/backend/adapters/ipc/registerRoute';
import Controller from '@/backend/adapters/controllers/Controller';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import FileUtil from '@/backend/utils/FileUtil';
import { getMainLogger } from '@/backend/infrastructure/logger';
import SettingsKeyValueService from '@/backend/application/services/SettingsKeyValueService';
import { StorageStatusVO } from '@/common/types/vo/StorageStatusVO';
import StorageDirectoryProvider, {
    StorageDirectoryTarget,
} from '@/backend/application/ports/gateways/storage/StorageDirectoryProvider';
import { getStorageRootStatus } from '@/backend/infrastructure/storage/StorageDirectorySupport';

@injectable()
export default class StorageController implements Controller {
    @inject(TYPES.SettingsKeyValueService) private settingsKeyValueService!: SettingsKeyValueService;
    @inject(TYPES.StorageDirectoryProvider) private storageDirectoryProvider!: StorageDirectoryProvider;
    private logger = getMainLogger('StorageController');

    /**
     * 写入指定设置项。
     * @param param0 设置项键值对。
     */
    public async storeSet({ key, value }: { key: SettingKey, value: string }): Promise<void> {
        this.logger.debug('store setting', { key, value });
        await this.settingsKeyValueService.set(key, value);
    }

    /**
     * 读取指定设置项。
     * @param key 设置项键。
     * @returns 当前设置值。
     */
    public async storeGet(key: SettingKey): Promise<string> {
        return this.settingsKeyValueService.get(key);
    }

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
        return getStorageRootStatus(await this.settingsKeyValueService.get('storage.path'));
    }

    /**
     * 列出可切换的收藏集合。
     * @returns 当前支持的集合列表。
     */
    public async listCollectionPaths(): Promise<string[]> {
        return ['default'];
    }


    registerRoutes(): void {
        registerRoute('storage/put', (p) => this.storeSet(p));
        registerRoute('storage/get', (p) => this.storeGet(p));
        registerRoute('storage/cache/size', () => this.queryCacheSize());
        registerRoute('storage/status', () => this.queryStorageStatus());
        registerRoute('storage/collection/paths', () => this.listCollectionPaths());
    }
}
