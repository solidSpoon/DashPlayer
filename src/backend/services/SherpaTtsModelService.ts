import { inject, injectable } from 'inversify';
import RendererGateway from '@/backend/services/gateways/renderer/RendererGateway';
import FileSystemGateway from '@/backend/services/gateways/storage/FileSystemGateway';
import StorageDirectoryProvider from '@/backend/services/gateways/storage/StorageDirectoryProvider';
import TYPES from '@/backend/ioc/types';
import { ModelArchiveInstaller } from '@/backend/services/models/ModelArchiveInstaller';
import {
    SHERPA_TTS_MODEL_ARCHIVE_NAME,
    SHERPA_TTS_MODEL_DIRECTORY,
    SHERPA_TTS_MODEL_DOWNLOAD_URL,
    SHERPA_TTS_REQUIRED_FILES,
} from '@/backend/services/models/sherpaTtsModel';
import type { ModelInstallationStatusVO } from '@/common/types/vo/model-installation-vo';

/** 模型归档下载的固定工作目录名（断点续传依赖固定路径）。 */
const DOWNLOAD_WORK_DIR = '.sherpa-tts-download';

/** 下载被取消时抛出的错误信息。 */
const DOWNLOAD_CANCELLED_MESSAGE = 'Sherpa TTS 模型下载已取消';

/**
 * SherpaTtsModelService 的业务契约。
 */
export default interface SherpaTtsModelService {
    /**
     * 查询 TTS 模型是否完整安装。
     * @returns 模型路径、就绪状态及下载状态。
     */
    getStatus(): Promise<ModelInstallationStatusVO>;

    /**
     * 下载并安装官方 Piper 英语 TTS 模型。
     * @returns 下载操作结果。
     */
    download(): Promise<{ success: boolean; message: string }>;

    /**
     * 取消正在进行的模型下载。
     * @returns 是否确实取消了下载任务。
     */
    cancelDownload(): Promise<{ cancelled: boolean }>;

    /**
     * 删除已安装的 TTS 模型。
     * @returns 删除结果。
     */
    deleteModel(): Promise<{ success: boolean; message: string }>;
}

/**
 * 负责 Sherpa-ONNX Piper TTS 模型的状态检查、下载和原子安装。
 *
 * 下载与安装流程由 {@link ModelArchiveInstaller} 统一实现，
 * 本服务只提供 Sherpa TTS 的差异配置。
 */
@injectable()
export class SherpaTtsModelServiceImpl implements SherpaTtsModelService {
    private readonly installer: ModelArchiveInstaller;

    constructor(
        @inject(TYPES.RendererGateway) rendererGateway: RendererGateway,
        @inject(TYPES.StorageDirectoryProvider) storageDirectoryProvider: StorageDirectoryProvider,
        @inject(TYPES.FileSystemGateway) fileSystemGateway: FileSystemGateway,
    ) {
        this.installer = new ModelArchiveInstaller(
            {
                downloadUrl: SHERPA_TTS_MODEL_DOWNLOAD_URL,
                workDirectoryName: DOWNLOAD_WORK_DIR,
                archiveFileName: SHERPA_TTS_MODEL_ARCHIVE_NAME,
                modelDirectoryName: SHERPA_TTS_MODEL_DIRECTORY,
                requiredFiles: [...SHERPA_TTS_REQUIRED_FILES],
                progressEventName: 'settings/sherpa-tts-model-download-progress',
                cancelledMessage: DOWNLOAD_CANCELLED_MESSAGE,
                modelDisplayName: 'Sherpa TTS',
            },
            rendererGateway,
            storageDirectoryProvider,
            fileSystemGateway,
        );
    }

    /**
     * 查询 TTS 模型是否完整安装。
     * @returns 模型路径、就绪状态及下载状态。
     */
    public getStatus(): Promise<ModelInstallationStatusVO> {
        return this.installer.getStatus();
    }

    /**
     * 下载并安装官方 Piper 英语 TTS 模型。
     * @returns 下载操作结果。
     */
    public download(): Promise<{ success: boolean; message: string }> {
        return this.installer.download();
    }

    /**
     * 取消正在进行的模型下载。
     * @returns 是否确实取消了下载任务。
     */
    public cancelDownload(): Promise<{ cancelled: boolean }> {
        return this.installer.cancelDownload();
    }

    /**
     * 删除已安装的 TTS 模型。
     * @returns 删除结果。
     */
    public deleteModel(): Promise<{ success: boolean; message: string }> {
        return this.installer.deleteModel();
    }
}
