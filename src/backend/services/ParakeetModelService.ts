import { inject, injectable } from 'inversify';
import RendererGateway from '@/backend/services/gateways/renderer/RendererGateway';
import FileSystemGateway from '@/backend/services/gateways/storage/FileSystemGateway';
import StorageDirectoryProvider from '@/backend/services/gateways/storage/StorageDirectoryProvider';
import TYPES from '@/backend/ioc/types';
import { ModelArchiveInstaller } from '@/backend/services/models/ModelArchiveInstaller';
import {
    PARAKEET_MODEL_ARCHIVE_NAME,
    PARAKEET_MODEL_DIRECTORY,
    PARAKEET_MODEL_ARCHIVE_SHA256,
    PARAKEET_MODEL_DOWNLOAD_URLS,
    PARAKEET_REQUIRED_FILES,
} from '@/backend/services/models/parakeetModel';
import { ORUKEET_ARCHIVE, ORUKEET_MANIFEST, ORUKEET_MODEL_DIRECTORY } from '@/backend/services/models/orukeetModel';
import type { ParakeetModelId } from '@/common/contracts/transcription-engine';
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
    getStatus(model?: ParakeetModelId): Promise<ModelInstallationStatusVO>;

    /**
     * 下载官方 INT8 模型归档并完成原子安装。
     * @returns 下载操作结果。
     */
    download(model?: ParakeetModelId): Promise<{ success: boolean; message: string }>;

    /**
     * 取消进行中的模型下载；无下载任务时直接返回。
     * @returns 是否确实中止了一个下载任务。
     */
    cancelDownload(model?: ParakeetModelId): Promise<{ cancelled: boolean }>;

    /**
     * 删除已下载的 Parakeet v3 模型目录。
     * @returns 删除结果；模型不存在时视为已删除。
     */
    deleteModel(model?: ParakeetModelId): Promise<{ success: boolean; message: string }>;
}

/**
 * 负责 Parakeet v3 模型状态检查、下载和原子安装。
 *
 * 下载与安装流程由 {@link ModelArchiveInstaller} 统一实现，
 * 本服务只提供 Parakeet 的差异配置。
 */
@injectable()
export class ParakeetModelServiceImpl implements ParakeetModelService {
    private readonly installers: Record<ParakeetModelId, ModelArchiveInstaller>;

    constructor(
        @inject(TYPES.RendererGateway) rendererGateway: RendererGateway,
        @inject(TYPES.StorageDirectoryProvider) storageDirectoryProvider: StorageDirectoryProvider,
        @inject(TYPES.FileSystemGateway) fileSystemGateway: FileSystemGateway,
    ) {
        const parakeet = new ModelArchiveInstaller(
            {
                downloadUrls: [...PARAKEET_MODEL_DOWNLOAD_URLS],
                archiveSha256: PARAKEET_MODEL_ARCHIVE_SHA256,
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
        const orukeet = new ModelArchiveInstaller(
            {
                downloadUrls: [ORUKEET_ARCHIVE.url],
                archiveSha256: ORUKEET_ARCHIVE.sha256,
                verificationManifest: ORUKEET_MANIFEST,
                workDirectoryName: '.orukeet-download',
                archiveFileName: ORUKEET_ARCHIVE.name,
                modelDirectoryName: ORUKEET_MODEL_DIRECTORY,
                requiredFiles: [...PARAKEET_REQUIRED_FILES, 'LICENSE-WEIGHTS', 'NOTICE.md'],
                progressEventName: 'settings/parakeet-model-download-progress',
                cancelledMessage: 'Orukeet 模型下载已取消',
                modelDisplayName: 'Orukeet',
            },
            rendererGateway,
            storageDirectoryProvider,
            fileSystemGateway,
        );
        this.installers = { parakeet, orukeet };
    }

    /** 按模型标识选择安装器；非法 IPC 参数必须显式失败。 */
    private installerFor(model: ParakeetModelId = 'parakeet'): ModelArchiveInstaller {
        if (model !== 'parakeet' && model !== 'orukeet') throw new Error(`模型标识非法: ${model}`);
        return this.installers[model];
    }

    /**
     * 查询 Parakeet v3 是否已完整安装。
     * @returns 模型路径、就绪状态与缺失文件。
     */
    public getStatus(model?: ParakeetModelId): Promise<ModelInstallationStatusVO> {
        return this.installerFor(model).getStatus();
    }

    /**
     * 下载官方 INT8 模型归档并完成原子安装。
     * @returns 下载操作结果。
     */
    public download(model?: ParakeetModelId): Promise<{ success: boolean; message: string }> {
        return this.installerFor(model).download();
    }

    /**
     * 取消进行中的模型下载；无下载任务时直接返回。
     * @returns 是否确实中止了一个下载任务。
     */
    public cancelDownload(model?: ParakeetModelId): Promise<{ cancelled: boolean }> {
        return this.installerFor(model).cancelDownload();
    }

    /**
     * 删除已下载的 Parakeet v3 模型目录。
     * @returns 删除结果；模型不存在时视为已删除。
     */
    public deleteModel(model?: ParakeetModelId): Promise<{ success: boolean; message: string }> {
        return this.installerFor(model).deleteModel();
    }
}
