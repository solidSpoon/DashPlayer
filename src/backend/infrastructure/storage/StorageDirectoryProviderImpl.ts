import {dialog} from 'electron';
import {inject, injectable} from 'inversify';
import fs from 'fs/promises';
import path from 'path';
import StorageDirectoryProvider, {
    StorageDirectoryTarget,
} from '@/backend/services/gateways/storage/StorageDirectoryProvider';
import {SettingsStore} from '@/backend/services/gateways/SettingsStore';
import TYPES from '@/backend/ioc/types';
import {
    canRecoverAccessFromSelection,
    getDirectoryAccessStatus,
    getStorageRootStatus,
    resolveStorageDirectory,
    StorageAccessTargetType,
} from '@/backend/infrastructure/storage/StorageDirectorySupport';
import {StorageStatusVO} from '@/common/types/vo/StorageStatusVO';

/**
 * 外部存储目录提供器实现。
 */
@injectable()
export default class StorageDirectoryProviderImpl implements StorageDirectoryProvider {
    private static readonly RECOVER_ACCESS_DIALOG_TITLE = '请重新选择可访问的文件夹';

    private static readonly RECOVER_ACCESS_DIALOG_MESSAGE = '当前文件夹暂时无法访问，请重新选择这个文件夹，或选择包含它的上层文件夹，以恢复访问权限';

    private activeRecoveryDialog: Promise<void> | null = null;

    constructor(
        @inject(TYPES.SettingsStore) private readonly settingsStore: SettingsStore,
    ) {}

    /**
     * 提供指定目标目录。
     * @param target 目录目标。
     * @returns 已确保存在的目标目录路径。
     */
    public async provideDirectory(target: StorageDirectoryTarget): Promise<string> {
        const rootPath = await this.ensureStorageRootAccessible();
        const targetPath = resolveStorageDirectory(rootPath, target);
        await this.ensureDirectoryAccessible(targetPath);
        return targetPath;
    }

    /**
     * 当路径已存在时，确保其所在位置具备访问权限。
     *
     * 使用约束：
     * - 仅用于存储目录体系之外的外部路径访问场景；
     * - 若路径位于 `provideDirectory(...)` 返回的目录体系内，应直接依赖目录方法，不要重复调用这里。
     *
     * @param targetPath 外部文件或文件夹绝对路径。
     */
    public async ensurePathAccessPermissionIfExists(targetPath: string): Promise<void> {
        const resolvedTargetPath = path.resolve(targetPath);
        const targetType = await this.detectExistingPathAccessTargetType(resolvedTargetPath);
        if (targetType === null) {
            return;
        }

        if (targetType === 'directory') {
            await this.ensureAccessibleWithRecovery(resolvedTargetPath);
            return;
        }

        await this.ensureAccessibleWithRecovery(path.dirname(resolvedTargetPath));
    }

    /**
     * 解析指定配置路径对应的媒体库根目录状态。
     *
     * 仅做状态检查，不触发目录创建或权限恢复弹窗。
     *
     * @param configuredPath 用户保存的原始路径。
     * @returns 媒体库根目录健康状态。
     */
    public async getRootStatus(configuredPath?: string): Promise<StorageStatusVO> {
        return await getStorageRootStatus(configuredPath);
    }

    /**
     * 确保外部根目录可访问。
     * @returns 当前可访问的根目录。
     */
    private async ensureStorageRootAccessible(): Promise<string> {
        const configuredPath = this.settingsStore.get('storage.path');
        let status = await getStorageRootStatus(configuredPath);

        if (status.available) {
            return status.resolvedPath;
        }

        if (status.code === 'missing') {
            status = await this.tryCreateMissingRoot(status, configuredPath);
            if (status.available) {
                return status.resolvedPath;
            }
        }

        if (status.code === 'not_directory') {
            throw new Error(status.message);
        }

        await this.ensureAccessibleWithRecovery(status.resolvedPath);
        return status.resolvedPath;
    }

    /**
     * 当根目录尚不存在时尝试主动创建。
     * @param status 当前状态。
     * @param configuredPath 用户保存的原始路径。
     * @returns 创建后的最新状态。
     */
    private async tryCreateMissingRoot(status: StorageStatusVO, configuredPath: string): Promise<StorageStatusVO> {
        try {
            await fs.mkdir(status.resolvedPath, { recursive: true });
            return await getStorageRootStatus(configuredPath);
        } catch {
            return status;
        }
    }

    /**
     * 确保目录可访问。
     * @param directoryPath 目录路径。
     */
    private async ensureDirectoryAccessible(directoryPath: string): Promise<void> {
        const resolvedDirectoryPath = path.resolve(directoryPath);

        try {
            await fs.mkdir(resolvedDirectoryPath, { recursive: true });
        } catch {
            await this.ensureAccessibleWithRecovery(resolvedDirectoryPath);
            await fs.mkdir(resolvedDirectoryPath, { recursive: true });
        }
    }
    /**
     * 在需要时引导用户恢复目标访问权限。
     *
     * 行为说明：
     * - 若当前已有恢复弹窗，则等待其结束后重新检查；
     * - 只有目标仍不可访问时，当前请求才会发起新的弹窗；
     * - 同一时刻仅保留一个恢复弹窗。
     *
     * @param targetPath 触发恢复的原始路径，可以是文件也可以是文件夹。
     */
    private async ensureAccessibleWithRecovery(targetPath: string): Promise<void> {
        const resolvedTargetPath = path.resolve(targetPath);
        const targetType = await this.detectExistingPathAccessTargetType(resolvedTargetPath);
        const recoveryDirectoryPath = targetType === 'directory'
            ? resolvedTargetPath
            : path.dirname(resolvedTargetPath);
        let needsRecheck = true;
        while (needsRecheck) {
            const status = await getDirectoryAccessStatus(recoveryDirectoryPath);
            if (status.available) {
                needsRecheck = false;
                continue;
            }

            if (status.code === 'not_directory') {
                throw new Error(status.message);
            }

            if (this.activeRecoveryDialog) {
                await this.waitForRecoveryDialog();
                continue;
            }

            await this.openRecoveryDialog(recoveryDirectoryPath);
        }
    }

    /**
     * 等待当前恢复弹窗结束。
     */
    private async waitForRecoveryDialog(): Promise<void> {
        try {
            await this.activeRecoveryDialog;
        } catch {
            // 当前请求只负责等待既有弹窗结束，随后重新检查访问状态。
        }
    }

    /**
     * 打开恢复访问弹窗，并在关闭后完成状态收尾。
     * @param directoryPath 待恢复访问的文件夹路径。
     */
    private async openRecoveryDialog(directoryPath: string): Promise<void> {
        const dialogTask = this.performRecoveryDialog(directoryPath);
        const dialogTaskWithCleanup = dialogTask.finally(() => {
            if (this.activeRecoveryDialog === dialogTaskWithCleanup) {
                this.activeRecoveryDialog = null;
            }
        });
        this.activeRecoveryDialog = dialogTaskWithCleanup;
        await dialogTask;
    }

    /**
     * 执行一次恢复访问弹窗。
     * @param directoryPath 待恢复访问的文件夹路径。
     */
    private async performRecoveryDialog(directoryPath: string): Promise<void> {
        const result = await dialog.showOpenDialog({
            title: StorageDirectoryProviderImpl.RECOVER_ACCESS_DIALOG_TITLE,
            message: StorageDirectoryProviderImpl.RECOVER_ACCESS_DIALOG_MESSAGE,
            defaultPath: directoryPath,
            properties: ['openDirectory'],
        });

        if (result.canceled || result.filePaths.length === 0) {
            throw new Error(StorageDirectoryProviderImpl.RECOVER_ACCESS_DIALOG_MESSAGE);
        }

        const selectedPath = path.resolve(result.filePaths[0]);

        if (!canRecoverAccessFromSelection(directoryPath, selectedPath)) {
            throw new Error(StorageDirectoryProviderImpl.RECOVER_ACCESS_DIALOG_MESSAGE);
        }

        const recoveredStatus = await getDirectoryAccessStatus(directoryPath);
        if (!recoveredStatus.available) {
            throw new Error(recoveredStatus.message);
        }
    }

    /**
     * 识别路径当前应按文件还是文件夹处理。
     *
     * 说明：
     * - 已存在目录按文件夹处理；
     * - 已存在文件按文件处理；
     * - 路径尚不存在时，按文件处理，便于恢复其所属位置的访问权限。
     *
     * @param targetPath 目标路径。
     * @returns 当前路径访问目标类型。
     */
    private async detectExistingPathAccessTargetType(targetPath: string): Promise<StorageAccessTargetType | null> {
        try {
            const stat = await fs.stat(targetPath);
            if (stat.isDirectory()) {
                return 'directory';
            }
            if (stat.isFile()) {
                return 'file';
            }
        } catch (error) {
            const errorCode = error instanceof Error && 'code' in error
                ? (error as NodeJS.ErrnoException).code
                : undefined;
            if (errorCode === 'ENOENT') {
                return null;
            }
            throw error;
        }

        throw new Error(`不支持的路径类型：${targetPath}`);
    }
}
