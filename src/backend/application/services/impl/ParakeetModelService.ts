import axios from 'axios';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import * as tarFs from 'tar-fs';
import unbzip2Stream from 'unbzip2-stream';
import { inject, injectable } from 'inversify';
import { getMainLogger } from '@/backend/infrastructure/logger';
import RendererGateway from '@/backend/application/ports/gateways/renderer/RendererGateway';
import StorageDirectoryProvider, { StorageDirectoryTarget } from '@/backend/application/ports/gateways/storage/StorageDirectoryProvider';
import TYPES from '@/backend/ioc/types';
import { ParakeetModelStatusVO } from '@/common/types/vo/parakeet-model-vo';
import type { ParakeetModelPhase } from '@/common/contracts/parakeet-model-phase';
import { PARAKEET_MODEL_DIRECTORY, PARAKEET_REQUIRED_FILES } from '@/backend/application/contracts/parakeetModel';

const ARCHIVE_URL = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8.tar.bz2';

/** 下载被取消时抛出的错误信息（渲染层据此区分取消与真实失败）。 */
export const PARAKEET_DOWNLOAD_CANCELLED_MESSAGE = 'Parakeet 模型下载已取消';

/** 模型归档下载的固定工作目录名（断点续传依赖固定路径）。 */
const DOWNLOAD_WORK_DIR = '.parakeet-download';

/** 模型归档临时文件名。 */
const ARCHIVE_FILE_NAME = 'model.tar.bz2';

/**
 * 负责 Parakeet v3 模型状态检查、下载和原子安装。
 */
@injectable()
export class ParakeetModelService {
    private readonly logger = getMainLogger('ParakeetModelService');

    private activeDownload: Promise<{ success: boolean; message: string }> | null = null;
    /** 当前下载的取消控制器；下载结束后置空。 */
    private activeAbortController: AbortController | null = null;
    /** 当前下载阶段；无下载任务时为 null。 */
    private currentPhase: ParakeetModelPhase | null = null;
    /** 当前下载进度（0-100）；无下载任务时为 0。 */
    private currentPercent = 0;

    constructor(
        @inject(TYPES.RendererGateway) private readonly rendererGateway: RendererGateway,
        @inject(TYPES.StorageDirectoryProvider) private readonly storageDirectoryProvider: StorageDirectoryProvider,
    ) {}

    /**
     * 查询 Parakeet v3 是否已完整安装。
     * @returns 模型路径、就绪状态与缺失文件。
     */
    public async getStatus(): Promise<ParakeetModelStatusVO> {
        const modelPath = await this.getModelPath();
        const missingFiles = PARAKEET_REQUIRED_FILES.filter((file) => !fs.existsSync(path.join(modelPath, file)));
        return {
            modelPath,
            ready: missingFiles.length === 0,
            missingFiles: [...missingFiles],
            downloading: this.activeDownload !== null,
            phase: this.currentPhase,
            percent: this.currentPercent,
        };
    }

    /**
     * 下载官方 INT8 模型归档并完成原子安装。
     * @returns 下载操作结果。
     */
    public async download(): Promise<{ success: boolean; message: string }> {
        if (this.activeDownload) return this.activeDownload;
        this.activeAbortController = new AbortController();
        this.currentPercent = 0;
        this.currentPhase = 'downloading';
        this.activeDownload = this.performDownload();
        try {
            return await this.activeDownload;
        } finally {
            this.activeDownload = null;
            this.activeAbortController = null;
            this.currentPhase = null;
            this.currentPercent = 0;
            // 广播终态，让已切页重挂载的页面也能复位下载状态。
            this.rendererGateway.fireAndForget('settings/parakeet-model-download-progress', { percent: 0, downloaded: 0, total: 0, phase: 'idle' });
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
        return { cancelled: true };
    }

    /**
     * 删除已下载的 Parakeet v3 模型目录。
     * @returns 删除结果；模型不存在时视为已删除。
     */
    public async deleteModel(): Promise<{ success: boolean; message: string }> {
        const modelPath = await this.getModelPath();
        if (!fs.existsSync(modelPath)) {
            return { success: true, message: 'Parakeet v3 模型已删除' };
        }
        await fsPromises.rm(modelPath, { recursive: true, force: true });
        return { success: true, message: 'Parakeet v3 模型已删除' };
    }

    /**
     * 执行一次模型下载、校验与目录切换。
     * @returns 下载操作结果。
     */
    private async performDownload(): Promise<{ success: boolean; message: string }> {
        const controller = this.activeAbortController;
        if (!controller) {
            throw new Error(PARAKEET_DOWNLOAD_CANCELLED_MESSAGE);
        }
        const current = await this.getStatus();
        if (current.ready) return { success: true, message: 'Parakeet v3 模型已就绪' };
        if (controller.signal.aborted) {
            throw new Error(PARAKEET_DOWNLOAD_CANCELLED_MESSAGE);
        }

        const modelsRoot = await this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.MODELS);
        // 固定工作目录：断点续传需要归档文件在多次下载尝试间保持在同一路径。
        const workDir = path.join(modelsRoot, DOWNLOAD_WORK_DIR);
        const archivePath = path.join(workDir, ARCHIVE_FILE_NAME);
        const extractPath = path.join(workDir, 'extract');
        await fsPromises.mkdir(workDir, { recursive: true });
        await fsPromises.mkdir(extractPath, { recursive: true });
        let installed = false;
        try {
            await this.downloadArchive(archivePath, controller.signal);
            this.emitPhase('extracting');
            await this.extractArchive(archivePath, extractPath);
            const sourceDir = await this.findModelDirectory(extractPath);
            const missingFiles = PARAKEET_REQUIRED_FILES.filter((file) => !fs.existsSync(path.join(sourceDir, file)));
            if (missingFiles.length > 0) throw new Error(`模型归档缺少文件：${missingFiles.join(', ')}`);
            if (controller.signal.aborted) {
                throw new Error(PARAKEET_DOWNLOAD_CANCELLED_MESSAGE);
            }
            this.emitPhase('installing');
            await this.replaceModelDirectory(sourceDir, current.modelPath);
            installed = true;
            return { success: true, message: 'Parakeet v3 模型下载完成' };
        } catch (error) {
            if (!controller.signal.aborted) {
                // 下载、校验或安装失败时清掉半成品，避免下次续传基于损坏文件。
                try {
                    await fsPromises.rm(workDir, { recursive: true, force: true });
                } catch (cleanupError) {
                    this.logger.warn('Failed to cleanup partial download', { cleanupError });
                }
            }
            throw error;
        } finally {
            // 安装成功后清理工作目录（解压产物已安装到模型目录）。
            // 取消时保留半成品归档，供下次断点续传。
            if (installed) {
                await fsPromises.rm(workDir, { recursive: true, force: true });
            }
        }
    }

    /**
     * 向渲染层广播当前下载阶段（解压/安装时进度条停在 100%）。
     * @param phase 目标阶段。
     */
    private emitPhase(phase: ParakeetModelPhase): void {
        this.currentPercent = 100;
        this.currentPhase = phase;
        this.rendererGateway.fireAndForget('settings/parakeet-model-download-progress', { percent: 100, downloaded: 0, total: 0, phase });
    }

    /** @returns 固定模型安装目录。 */
    private async getModelPath(): Promise<string> {
        const modelsRoot = await this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.MODELS);
        return path.join(modelsRoot, PARAKEET_MODEL_DIRECTORY);
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
        const response = await axios.get(ARCHIVE_URL, { responseType: 'stream', signal, headers });
        const total = Number(response.headers['content-length'] ?? 0) + (response.status === 206 ? existingSize : 0);
        // 服务器返回 200 说明不支持续传或远端文件已变化，此时应覆盖重写且进度从 0 计。
        const resuming = response.status === 206;

        await new Promise<void>((resolve, reject) => {
            const writer = fs.createWriteStream(archivePath, resuming ? { flags: 'a' } : {});
            let downloaded = resuming ? existingSize : 0;
            const onAbort = () => {
                writer.destroy();
                reject(new Error(PARAKEET_DOWNLOAD_CANCELLED_MESSAGE));
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
                this.rendererGateway.fireAndForget('settings/parakeet-model-download-progress', { percent, downloaded, total, phase: 'downloading' });
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
     * @returns 文件字节数；文件不存在或读取失败时返回 0。
     */
    private async getExistingArchiveSize(archivePath: string): Promise<number> {
        try {
            const stat = await fsPromises.stat(archivePath);
            return stat.isFile() ? stat.size : 0;
        } catch {
            return 0;
        }
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
            throw new Error(`模型解压失败：${error instanceof Error ? error.message : String(error)}`, { cause: error });
        }
    }

    /**
     * 在归档顶层定位包含全部必需文件的目录。
     * @param extractPath 解压根目录。
     * @returns 模型源目录。
     */
    private async findModelDirectory(extractPath: string): Promise<string> {
        const entries = await fsPromises.readdir(extractPath, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const candidate = path.join(extractPath, entry.name);
            if (PARAKEET_REQUIRED_FILES.every((file) => fs.existsSync(path.join(candidate, file)))) return candidate;
        }
        throw new Error('模型归档中未找到 Parakeet v3 模型目录');
    }

    /**
     * 用已校验目录替换当前模型；切换失败时恢复原目录。
     * @param sourceDir 已校验的新模型目录。
     * @param targetDir 固定模型安装目录。
     */
    private async replaceModelDirectory(sourceDir: string, targetDir: string): Promise<void> {
        const backupDir = `${targetDir}.backup-${Date.now()}`;
        const hasCurrent = fs.existsSync(targetDir);
        if (hasCurrent) await fsPromises.rename(targetDir, backupDir);
        try {
            await fsPromises.rename(sourceDir, targetDir);
            if (hasCurrent) await fsPromises.rm(backupDir, { recursive: true, force: true });
        } catch (error) {
            if (hasCurrent && !fs.existsSync(targetDir)) await fsPromises.rename(backupDir, targetDir);
            throw error;
        }
    }
}
