import { inject, injectable } from 'inversify';
import RendererGateway from '@/backend/services/gateways/renderer/RendererGateway';
import FileSystemGateway from '@/backend/services/gateways/storage/FileSystemGateway';
import StorageDirectoryProvider from '@/backend/services/gateways/storage/StorageDirectoryProvider';
import TYPES from '@/backend/ioc/types';
import { ModelArchiveInstaller } from '@/backend/services/models/ModelArchiveInstaller';
import {
    PARAKEET_MODEL_ARCHIVE_NAME,
    PARAKEET_MODEL_DIRECTORY,
    PARAKEET_MODEL_DOWNLOAD_URL,
    PARAKEET_REQUIRED_FILES,
} from '@/backend/services/models/parakeetModel';
import type { ModelInstallationStatusVO } from '@/common/types/vo/model-installation-vo';

/** 模型归档下载的固定工作目录名（断点续传依赖固定路径）。 */
const DOWNLOAD_WORK_DIR = '.parakeet-download';

/** 下载被取消时抛出的错误信息。 */
const DOWNLOAD_CANCELLED_MESSAGE = 'Parakeet 模型下载已取消';

/**
 * ParakeetModelService 的业务契约。
 */
export default interface ParakeetModelService {
    /**
     * 查询 Parakeet v3 是否已完整安装。
     * @returns 模型路径、就绪状态与缺失文件。
     */
    getStatus(): Promise<ModelInstallationStatusVO>;

    /**
     * 下载官方 INT8 模型归档并完成原子安装。
     * @returns 下载操作结果。
     */
    download(): Promise<{ success: boolean; message: string }>;

    /**
     * 取消进行中的模型下载；无下载任务时直接返回。
     * @returns 是否确实中止了一个下载任务。
     */
    cancelDownload(): Promise<{ cancelled: boolean }>;

    /**
     * 删除已下载的 Parakeet v3 模型目录。
     * @returns 删除结果；模型不存在时视为已删除。
     */
    deleteModel(): Promise<{ success: boolean; message: string }>;
}

/**
 * 负责 Parakeet v3 模型状态检查、下载和原子安装。
 *
 * 下载与安装流程由 {@link ModelArchiveInstaller} 统一实现，
 * 本服务只提供 Parakeet 的差异配置。
 */
@injectable()
export class ParakeetModelServiceImpl implements ParakeetModelService {
    private readonly installer: ModelArchiveInstaller;

    constructor(
        @inject(TYPES.RendererGateway) rendererGateway: RendererGateway,
        @inject(TYPES.StorageDirectoryProvider) storageDirectoryProvider: StorageDirectoryProvider,
        @inject(TYPES.FileSystemGateway) fileSystemGateway: FileSystemGateway,
    ) {
        this.installer = new ModelArchiveInstaller(
            {
                downloadUrl: PARAKEET_MODEL_DOWNLOAD_URL,
                workDirectoryName: DOWNLOAD_WORK_DIR,
                archiveFileName: PARAKEET_MODEL_ARCHIVE_NAME,
                modelDirectoryName: PARAKEET_MODEL_DIRECTORY,
                requiredFiles: [...PARAKEET_REQUIRED_FILES],
                progressEventName: 'settings/parakeet-model-download-progress',
                cancelledMessage: DOWNLOAD_CANCELLED_MESSAGE,
                modelDisplayName: 'Parakeet v3',
            },
            rendererGateway,
            storageDirectoryProvider,
            fileSystemGateway,
        );
    }

    /**
     * 查询 Parakeet v3 是否已完整安装。
     * @returns 模型路径、就绪状态与缺失文件。
     */
    public getStatus(): Promise<ModelInstallationStatusVO> {
        return this.installer.getStatus();
    }

    /**
     * 下载官方 INT8 模型归档并完成原子安装。
     * @returns 下载操作结果。
     */
    public download(): Promise<{ success: boolean; message: string }> {
        return this.installer.download();
    }

    /**
     * 取消进行中的模型下载；无下载任务时直接返回。
     * @returns 是否确实中止了一个下载任务。
     */
    public cancelDownload(): Promise<{ cancelled: boolean }> {
        return this.installer.cancelDownload();
    }

    /**
     * 删除已下载的 Parakeet v3 模型目录。
     * @returns 删除结果；模型不存在时视为已删除。
     */
    public deleteModel(): Promise<{ success: boolean; message: string }> {
        return this.installer.deleteModel();
    }
}
