import { inject, injectable } from 'inversify';
import RendererGateway from '@/backend/services/gateways/renderer/RendererGateway';
import FileSystemGateway from '@/backend/services/gateways/storage/FileSystemGateway';
import StorageDirectoryProvider from '@/backend/services/gateways/storage/StorageDirectoryProvider';
import TYPES from '@/backend/ioc/types';
import { ModelArchiveInstaller } from '@/backend/services/models/ModelArchiveInstaller';
import {
    WHISPER_CPP_MODEL_ARCHIVE_NAME,
    WHISPER_CPP_MODEL_DIRECTORY,
    WHISPER_CPP_MODEL_DOWNLOAD_URLS,
    WHISPER_CPP_REQUIRED_FILES,
} from '@/backend/services/models/whisperCppModel';
import type { ModelInstallationStatusVO } from '@/common/types/vo/model-installation-vo';

/** whisper.cpp 模型归档下载的固定工作目录名（断点续传依赖固定路径）。 */
const DOWNLOAD_WORK_DIR = '.whisper-cpp-download';

/** whisper.cpp 模型下载被取消时抛出的错误信息。 */
const DOWNLOAD_CANCELLED_MESSAGE = 'whisper.cpp 模型下载已取消';

/**
 * WhisperCppModelService 的业务契约。
 */
export default interface WhisperCppModelService {
    /**
     * 查询 whisper.cpp 引擎的 GGUF 模型是否已完整安装。
     * @returns 模型路径、就绪状态与缺失文件。
     */
    getStatus(): Promise<ModelInstallationStatusVO>;

    /**
     * 下载 GGUF 模型文件并完成原子安装。
     * @returns 下载操作结果。
     */
    download(): Promise<{ success: boolean; message: string }>;

    /**
     * 取消进行中的模型下载；无下载任务时直接返回。
     * @returns 是否确实中止了一个下载任务。
     */
    cancelDownload(): Promise<{ cancelled: boolean }>;

    /**
     * 删除已下载的 GGUF 模型目录。
     * @returns 删除结果；模型不存在时视为已删除。
     */
    deleteModel(): Promise<{ success: boolean; message: string }>;
}

/**
 * 负责 whisper.cpp 引擎 Parakeet v3 GGUF 模型的状态检查、下载和原子安装。
 *
 * GGUF 是单文件形态（无归档壳），通过 `archiveKind: 'raw'` 复用
 * {@link ModelArchiveInstaller} 的断点续传与原子安装流程。
 */
@injectable()
export class WhisperCppModelServiceImpl implements WhisperCppModelService {
    private readonly installer: ModelArchiveInstaller;

    constructor(
        @inject(TYPES.RendererGateway) rendererGateway: RendererGateway,
        @inject(TYPES.StorageDirectoryProvider) storageDirectoryProvider: StorageDirectoryProvider,
        @inject(TYPES.FileSystemGateway) fileSystemGateway: FileSystemGateway,
    ) {
        this.installer = new ModelArchiveInstaller(
            {
                downloadUrls: [...WHISPER_CPP_MODEL_DOWNLOAD_URLS],
                workDirectoryName: DOWNLOAD_WORK_DIR,
                archiveFileName: WHISPER_CPP_MODEL_ARCHIVE_NAME,
                archiveKind: 'raw',
                modelDirectoryName: WHISPER_CPP_MODEL_DIRECTORY,
                requiredFiles: [...WHISPER_CPP_REQUIRED_FILES],
                progressEventName: 'settings/whisper-cpp-model-download-progress',
                cancelledMessage: DOWNLOAD_CANCELLED_MESSAGE,
                modelDisplayName: 'whisper.cpp',
            },
            rendererGateway,
            storageDirectoryProvider,
            fileSystemGateway,
        );
    }

    /**
     * 查询 whisper.cpp 引擎的 GGUF 模型是否已完整安装。
     * @returns 模型路径、就绪状态与缺失文件。
     */
    public getStatus(): Promise<ModelInstallationStatusVO> {
        return this.installer.getStatus();
    }

    /**
     * 下载 GGUF 模型文件并完成原子安装。
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
     * 删除已下载的 GGUF 模型目录。
     * @returns 删除结果；模型不存在时视为已删除。
     */
    public deleteModel(): Promise<{ success: boolean; message: string }> {
        return this.installer.deleteModel();
    }
}
