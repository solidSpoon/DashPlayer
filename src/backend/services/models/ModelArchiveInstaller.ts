import axios, { isAxiosError } from 'axios';
import fs from 'fs';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import * as tarFs from 'tar-fs';
import unbzip2Stream from 'unbzip2-stream';
import { getMainLogger } from '@/backend/infrastructure/logger';
import RendererGateway from '@/backend/services/gateways/renderer/RendererGateway';
import FileSystemGateway from '@/backend/services/gateways/storage/FileSystemGateway';
import StorageDirectoryProvider, { StorageDirectoryTarget } from '@/backend/services/gateways/storage/StorageDirectoryProvider';
import type { ModelDownloadPhase } from '@/common/contracts/model-download-phase';
import type { ModelInstallationStatusVO } from '@/common/types/vo/model-installation-vo';

/**
 * 模型安装器的差异配置，由各模型服务提供。
 */
export interface ModelArchiveInstallerOptions {
    /** 官方模型归档下载地址。 */
    downloadUrl: string;
    /** 下载工作目录名（位于 models 根目录下；断点续传依赖固定路径）。 */
    workDirectoryName: string;
    /** 归档文件名。 */
    archiveFileName: string;
    /** 安装目标目录名（位于 models 根目录下）。 */
    modelDirectoryName: string;
    /** 安装完成后必须存在的文件列表。 */
    requiredFiles: string[];
    /** 向前端广播下载进度的事件名。 */
    progressEventName: 'settings/parakeet-model-download-progress' | 'settings/sherpa-tts-model-download-progress';
    /** 下载被取消时抛出的错误信息。 */
    cancelledMessage: string;
    /** 模型显示名，用于结果消息和日志。 */
    modelDisplayName: string;
}

/**
 * 官方模型归档（tar.bz2）的下载、校验与原子安装流程。
 *
 * 供 Parakeet 转写模型和 Sherpa TTS 模型共用；两个模型仅归档地址、
 * 目录名、必需文件清单等配置不同。目录与文件的离散操作全部走
 * {@link FileSystemGateway}；归档的流式写入与解压直接使用 Node 流，
 * 因为断点续传与流式解压不适配网关的整文件操作语义。
 */
export class ModelArchiveInstaller {
    private readonly logger = getMainLogger('ModelArchiveInstaller');

    private activeDownload: Promise<{ success: boolean; message: string }> | null = null;
    /** 当前下载的取消控制器；下载结束后置空。 */
    private activeAbortController: AbortController | null = null;
    /** 当前下载阶段；无下载任务时为 null。 */
    private currentPhase: ModelDownloadPhase | null = null;
    /** 当前下载进度（0-100）；无下载任务时为 0。 */
    private currentPercent = 0;

    constructor(
        private readonly options: ModelArchiveInstallerOptions,
        private readonly rendererGateway: RendererGateway,
        private readonly storageDirectoryProvider: StorageDirectoryProvider,
        private readonly fileSystemGateway: FileSystemGateway,
    ) {}

    /**
     * 查询模型安装与下载状态。
     * @returns 模型路径、就绪状态及下载状态。
     */
    public async getStatus(): Promise<ModelInstallationStatusVO> {
        const modelPath = await this.getModelPath();
        const archivePath = path.join(path.dirname(modelPath), this.options.workDirectoryName, this.options.archiveFileName);
        const missingFiles: string[] = [];
        for (const entryName of this.options.requiredFiles) {
            if (!(await this.hasRequiredEntry(modelPath, entryName))) {
                missingFiles.push(entryName);
            }
        }
        return {
            modelPath,
            ready: missingFiles.length === 0,
            missingFiles,
            downloading: this.activeDownload !== null,
            phase: this.currentPhase,
            percent: this.currentPercent,
            downloadUrl: this.options.downloadUrl,
            archivePath,
        };
    }

    /**
     * 下载并安装模型归档；已有下载任务时复用同一任务。
     * @returns 下载操作结果。
     */
    public async download(): Promise<{ success: boolean; message: string }> {
        if (this.activeDownload) return this.activeDownload;
        this.activeAbortController = new AbortController();
        this.currentPercent = 0;
        this.currentPhase = 'downloading';
        this.logger.info('model download start', { model: this.options.modelDisplayName });
        this.activeDownload = this.performDownload();
        try {
            return await this.activeDownload;
        } finally {
            this.activeDownload = null;
            this.activeAbortController = null;
            this.currentPhase = null;
            this.currentPercent = 0;
            // 广播终态，让已切页重挂载的页面也能复位下载状态。
            this.rendererGateway.fireAndForget(this.options.progressEventName, {
                percent: 0,
                downloaded: 0,
                total: 0,
                phase: 'idle',
            });
        }
    }

    /**
     * 取消进行中的模型下载；无下载任务时直接返回。
     * @returns 是否确实中止了一个下载任务。
     */
    public async cancelDownload(): Promise<{ cancelled: boolean }> {
        const controller = this.activeAbortController;
        if (!controller || this.activeDownload === null) {
            return { cancelled: false };
        }
        controller.abort();
        this.logger.warn('model download cancel requested', { model: this.options.modelDisplayName });
        return { cancelled: true };
    }

    /**
     * 删除已安装的模型目录；模型不存在时视为已删除。
     * @returns 删除结果。
     */
    public async deleteModel(): Promise<{ success: boolean; message: string }> {
        const modelPath = await this.getModelPath();
        await this.fileSystemGateway.removeDirectoryIfExists(modelPath);
        return { success: true, message: `${this.options.modelDisplayName} 模型已删除` };
    }

    /**
     * 执行一次模型下载、校验与目录切换。
     * @returns 下载操作结果。
     */
    private async performDownload(): Promise<{ success: boolean; message: string }> {
        const controller = this.activeAbortController;
        if (!controller) {
            throw new Error(this.options.cancelledMessage);
        }
        const current = await this.getStatus();
        if (current.ready) return { success: true, message: `${this.options.modelDisplayName} 模型已就绪` };
        if (controller.signal.aborted) {
            throw new Error(this.options.cancelledMessage);
        }

        const startedAt = Date.now();
        const workDir = path.join(path.dirname(current.modelPath), this.options.workDirectoryName);
        const archivePath = path.join(workDir, this.options.archiveFileName);
        const extractPath = path.join(workDir, 'extract');
        await this.fileSystemGateway.ensureDirectory(workDir);
        await this.fileSystemGateway.removeDirectoryIfExists(extractPath);
        await this.fileSystemGateway.ensureDirectory(extractPath);
        let installed = false;
        try {
            await this.downloadArchive(archivePath, controller.signal);
            this.emitPhase('extracting');
            await this.extractArchive(archivePath, extractPath);
            const sourceDir = await this.findModelDirectory(extractPath);
            const missingFiles: string[] = [];
            for (const entryName of this.options.requiredFiles) {
                if (!(await this.hasRequiredEntry(sourceDir, entryName))) {
                    missingFiles.push(entryName);
                }
            }
            if (missingFiles.length > 0) {
                throw new Error(`${this.options.modelDisplayName} 模型归档缺少文件：${missingFiles.join(', ')}`);
            }
            if (controller.signal.aborted) {
                throw new Error(this.options.cancelledMessage);
            }
            this.emitPhase('installing');
            await this.replaceModelDirectory(sourceDir, current.modelPath);
            installed = true;
            this.logger.info('model download complete', { model: this.options.modelDisplayName, durationMs: Date.now() - startedAt });
            return { success: true, message: `${this.options.modelDisplayName} 模型下载完成` };
        } catch (error) {
            if (controller.signal.aborted) {
                this.logger.warn('model download cancelled', { model: this.options.modelDisplayName, durationMs: Date.now() - startedAt });
            } else {
                this.logger.error('model download failed', { model: this.options.modelDisplayName, durationMs: Date.now() - startedAt, error });
                // 保留归档和工作目录，用户可手动补齐后再次点击下载，继续断点续传或直接安装。
            }
            throw error;
        } finally {
            // 安装成功后清理工作目录（解压产物已安装到模型目录）；取消时保留半成品归档供断点续传。
            if (installed) {
                await this.fileSystemGateway.removeDirectoryIfExists(workDir);
            }
        }
    }

    /**
     * 向渲染层广播当前下载阶段（解压/安装时进度条停在 100%）。
     * @param phase 目标阶段。
     */
    private emitPhase(phase: ModelDownloadPhase): void {
        this.currentPercent = 100;
        this.currentPhase = phase;
        this.logger.info('model download phase', { model: this.options.modelDisplayName, phase });
        this.rendererGateway.fireAndForget(this.options.progressEventName, {
            percent: 100,
            downloaded: 0,
            total: 0,
            phase,
        });
    }

    /** @returns 固定模型安装目录。 */
    private async getModelPath(): Promise<string> {
        const modelsRoot = await this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.MODELS);
        return path.join(modelsRoot, this.options.modelDirectoryName);
    }

    /**
     * 断点续传下载模型归档。
     * 完整性不依赖服务器 ETag（GitHub 返回的 Azure ETag 不是内容摘要），
     * 由随后的解压与必需文件检查兜底：下载损坏必然导致解压失败或文件缺失。
     * @param archivePath 归档文件路径（已存在的部分内容会被续传）。
     * @param signal 取消信号。
     */
    private async downloadArchive(archivePath: string, signal: AbortSignal): Promise<void> {
        const existingSize = await this.getExistingArchiveSize(archivePath);
        // 续传：从已下载的字节数开始请求剩余部分。
        const headers = existingSize > 0 ? { Range: `bytes=${existingSize}-` } : {};
        let response;
        try {
            response = await axios.get(this.options.downloadUrl, { responseType: 'stream', signal, headers });
        } catch (error) {
            // 完整归档手动放置后，Range 请求可能得到 416；保留现有文件并交给解压校验。
            if (existingSize > 0 && isAxiosError(error) && error.response?.status === 416) return;
            throw error;
        }
        const total = Number(response.headers['content-length'] ?? 0) + (response.status === 206 ? existingSize : 0);
        // 服务器返回 200 说明不支持续传或远端文件已变化，此时应覆盖重写且进度从 0 计。
        const resuming = response.status === 206;

        await new Promise<void>((resolve, reject) => {
            const writer = fs.createWriteStream(archivePath, resuming ? { flags: 'a' } : {});
            let downloaded = resuming ? existingSize : 0;
            const onAbort = () => {
                writer.destroy();
                reject(new Error(this.options.cancelledMessage));
            };
            if (signal.aborted) {
                onAbort();
                return;
            }
            signal.addEventListener('abort', onAbort, { once: true });
            response.data.on('data', (chunk: Buffer) => {
                downloaded += chunk.length;
                const percent = total > 0 ? Math.floor(downloaded / total * 100) : 0;
                this.currentPercent = percent;
                this.currentPhase = 'downloading';
                this.rendererGateway.fireAndForget(this.options.progressEventName, {
                    percent,
                    downloaded,
                    total,
                    phase: 'downloading',
                });
            });
            response.data.on('error', (error: Error) => {
                signal.removeEventListener('abort', onAbort);
                reject(error);
            });
            response.data.pipe(writer);
            writer.on('finish', () => {
                signal.removeEventListener('abort', onAbort);
                resolve();
            });
            writer.on('error', (error: Error) => {
                signal.removeEventListener('abort', onAbort);
                reject(error);
            });
        });
    }

    /**
     * 读取已存在的归档文件大小，用于断点续传。
     * @param archivePath 归档文件路径。
     * @returns 文件字节数；文件不存在时返回 0。
     */
    private async getExistingArchiveSize(archivePath: string): Promise<number> {
        if (await this.fileSystemGateway.pathIsMissing(archivePath)) {
            return 0;
        }
        return this.fileSystemGateway.getFileSize(archivePath);
    }

    /**
     * 在 Node 进程内流式解压官方 tar.bz2 归档，避免依赖系统 tar 或 bzip2。
     * @param archivePath 归档文件。
     * @param extractPath 解压目录。
     */
    private async extractArchive(archivePath: string, extractPath: string): Promise<void> {
        try {
            await pipeline(
                fs.createReadStream(archivePath),
                unbzip2Stream(),
                tarFs.extract(extractPath),
            );
        } catch (error) {
            throw new Error(`${this.options.modelDisplayName} 模型归档解压失败：${error instanceof Error ? error.message : String(error)}`, { cause: error });
        }
    }

    /**
     * 在归档顶层定位包含全部必需文件的目录。
     *
     * 行为说明：
     * - 优先在解压根目录的子目录中查找；
     * - 找不到时回退检查解压根目录本身（部分归档不带外层目录）。
     *
     * @param extractPath 解压根目录。
     * @returns 模型源目录。
     */
    protected async findModelDirectory(extractPath: string): Promise<string> {
        const subDirectoryNames = await this.fileSystemGateway.listDirectoryNames(extractPath);
        for (const directoryName of subDirectoryNames) {
            const candidate = path.join(extractPath, directoryName);
            if (await this.hasAllRequiredEntries(candidate)) return candidate;
        }
        if (await this.hasAllRequiredEntries(extractPath)) return extractPath;
        throw new Error(`${this.options.modelDisplayName} 模型归档中未找到完整模型目录`);
    }

    /**
     * 检查必需条目是否存在于指定目录。
     *
     * 必需清单中既有文件也有目录（如 Sherpa 的 espeak-ng-data），
     * 因此这里检查的是“路径存在”（文件或目录均可），不能用严格只认
     * 普通文件的 `fileExists`。
     *
     * @param directoryPath 待检查目录。
     * @param entryName 必需条目名。
     * @returns 条目存在时返回 `true`。
     */
    private async hasRequiredEntry(directoryPath: string, entryName: string): Promise<boolean> {
        return !(await this.fileSystemGateway.pathIsMissing(path.join(directoryPath, entryName)));
    }

    /** @param directoryPath 待检查目录 @returns 必需条目是否齐全。 */
    private async hasAllRequiredEntries(directoryPath: string): Promise<boolean> {
        for (const entryName of this.options.requiredFiles) {
            if (!(await this.hasRequiredEntry(directoryPath, entryName))) {
                return false;
            }
        }
        return true;
    }

    /**
     * 用已校验目录替换当前模型；切换失败时恢复原目录。
     * @param sourceDir 已校验的新模型目录。
     * @param targetDir 固定模型安装目录。
     */
    protected async replaceModelDirectory(sourceDir: string, targetDir: string): Promise<void> {
        const backupDir = `${targetDir}.backup-${Date.now()}`;
        const hasCurrent = await this.fileSystemGateway.directoryExists(targetDir);
        if (hasCurrent) await this.fileSystemGateway.moveFile(targetDir, backupDir);
        try {
            await this.fileSystemGateway.moveFile(sourceDir, targetDir);
            if (hasCurrent) await this.fileSystemGateway.removeDirectoryIfExists(backupDir);
        } catch (error) {
            if (hasCurrent && await this.fileSystemGateway.pathIsMissing(targetDir)) {
                await this.fileSystemGateway.moveFile(backupDir, targetDir);
            }
            throw error;
        }
    }
}
