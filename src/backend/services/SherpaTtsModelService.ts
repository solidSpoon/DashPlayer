import axios from 'axios';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import * as tarFs from 'tar-fs';
import unbzip2Stream from 'unbzip2-stream';
import { inject, injectable } from 'inversify';
import { getMainLogger } from '@/backend/infrastructure/logger';
import RendererGateway from '@/backend/services/gateways/renderer/RendererGateway';
import StorageDirectoryProvider, { StorageDirectoryTarget } from '@/backend/services/gateways/storage/StorageDirectoryProvider';
import TYPES from '@/backend/ioc/types';
import { SHERPA_TTS_MODEL_ARCHIVE_NAME, SHERPA_TTS_MODEL_DIRECTORY, SHERPA_TTS_MODEL_DOWNLOAD_URL, SHERPA_TTS_REQUIRED_FILES } from '@/backend/services/models/sherpaTtsModel';
import type { SherpaTtsModelStatusVO } from '@/common/types/vo/sherpa-tts-model-vo';
import type { ParakeetModelPhase } from '@/common/contracts/parakeet-model-phase';

const ARCHIVE_URL = SHERPA_TTS_MODEL_DOWNLOAD_URL;
const DOWNLOAD_WORK_DIR = '.sherpa-tts-download';
const ARCHIVE_FILE_NAME = SHERPA_TTS_MODEL_ARCHIVE_NAME;
export const SHERPA_TTS_DOWNLOAD_CANCELLED_MESSAGE = 'Sherpa TTS 模型下载已取消';/**
 * SherpaTtsModelService 的业务契约。
 */
export default interface SherpaTtsModelService {
    /**
     * 查询 TTS 模型是否完整安装。
     * @returns 模型路径、就绪状态及下载状态。
     */
    getStatus(): Promise<SherpaTtsModelStatusVO>;

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
 */
@injectable()
export class SherpaTtsModelServiceImpl implements SherpaTtsModelService {
    private readonly logger = getMainLogger('SherpaTtsModelService');
    private activeDownload: Promise<{ success: boolean; message: string }> | null = null;
    private activeAbortController: AbortController | null = null;
    private currentPhase: ParakeetModelPhase | null = null;
    private currentPercent = 0;

    constructor(
        @inject(TYPES.RendererGateway) private readonly rendererGateway: RendererGateway,
        @inject(TYPES.StorageDirectoryProvider) private readonly storageDirectoryProvider: StorageDirectoryProvider,
    ) {}

    /**
     * 查询 TTS 模型是否完整安装。
     * @returns 模型路径、就绪状态及下载状态。
     */
    public async getStatus(): Promise<SherpaTtsModelStatusVO> {
        const modelPath = await this.getModelPath();
        const archivePath = path.join(path.dirname(modelPath), DOWNLOAD_WORK_DIR, ARCHIVE_FILE_NAME);
        const missingFiles = SHERPA_TTS_REQUIRED_FILES.filter((file) => !fs.existsSync(path.join(modelPath, file)));
        return {
            modelPath,
            ready: missingFiles.length === 0,
            missingFiles: [...missingFiles],
            downloading: this.activeDownload !== null,
            phase: this.currentPhase,
            percent: this.currentPercent,
            downloadUrl: ARCHIVE_URL,
            archivePath,
        };
    }

    /**
     * 下载并安装官方 Piper 英语 TTS 模型。
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
            this.rendererGateway.fireAndForget('settings/sherpa-tts-model-download-progress', {
                percent: 0,
                downloaded: 0,
                total: 0,
                phase: 'idle',
            });
        }
    }

    /**
     * 取消正在进行的模型下载。
     * @returns 是否确实取消了下载任务。
     */
    public async cancelDownload(): Promise<{ cancelled: boolean }> {
        if (!this.activeAbortController || !this.activeDownload) return { cancelled: false };
        this.activeAbortController.abort();
        return { cancelled: true };
    }

    /**
     * 删除已安装的 TTS 模型。
     * @returns 删除结果。
     */
    public async deleteModel(): Promise<{ success: boolean; message: string }> {
        const modelPath = await this.getModelPath();
        await fsPromises.rm(modelPath, { recursive: true, force: true });
        return { success: true, message: 'Sherpa TTS 模型已删除' };
    }

    /**
     * 执行下载、解压、校验和原子安装。
     * @returns 下载操作结果。
     */
    private async performDownload(): Promise<{ success: boolean; message: string }> {
        const controller = this.activeAbortController;
        if (!controller) throw new Error(SHERPA_TTS_DOWNLOAD_CANCELLED_MESSAGE);
        const current = await this.getStatus();
        if (current.ready) return { success: true, message: 'Sherpa TTS 模型已就绪' };
        const modelsRoot = await this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.MODELS);
        const workDir = path.join(modelsRoot, DOWNLOAD_WORK_DIR);
        const archivePath = path.join(workDir, ARCHIVE_FILE_NAME);
        const extractPath = path.join(workDir, 'extract');
        await fsPromises.rm(extractPath, { recursive: true, force: true });
        await fsPromises.mkdir(extractPath, { recursive: true });
        let installed = false;
        try {
            await this.downloadArchive(archivePath, controller.signal);
            this.emitPhase('extracting');
            await pipeline(fs.createReadStream(archivePath), unbzip2Stream(), tarFs.extract(extractPath));
            const sourceDir = await this.findModelDirectory(extractPath);
            const missingFiles = SHERPA_TTS_REQUIRED_FILES.filter((file) => !fs.existsSync(path.join(sourceDir, file)));
            if (missingFiles.length > 0) throw new Error(`TTS 模型归档缺少文件：${missingFiles.join(', ')}`);
            if (controller.signal.aborted) throw new Error(SHERPA_TTS_DOWNLOAD_CANCELLED_MESSAGE);
            this.emitPhase('installing');
            await this.replaceModelDirectory(sourceDir, current.modelPath);
            installed = true;
            return { success: true, message: 'Sherpa TTS 模型下载完成' };
        } catch (error) {
            if (!controller.signal.aborted) {
                this.logger.error('sherpa tts model download failed', { error });
                // 保留归档和工作目录，支持用户手动下载后继续安装。
            }
            throw error;
        } finally {
            if (installed) await fsPromises.rm(workDir, { recursive: true, force: true });
        }
    }

    /**
     * 下载模型归档并报告进度。
     * @param archivePath 归档保存路径。
     * @param signal 取消信号。
     */
    private async downloadArchive(archivePath: string, signal: AbortSignal): Promise<void> {
        await fsPromises.mkdir(path.dirname(archivePath), { recursive: true });
        const existingSize = await this.getExistingArchiveSize(archivePath);
        let response;
        try {
            response = await axios.get(ARCHIVE_URL, {
                responseType: 'stream',
                signal,
                headers: existingSize > 0 ? { Range: `bytes=${existingSize}-` } : {},
            });
        } catch (error) {
            if (existingSize > 0 && axios.isAxiosError(error) && error.response?.status === 416) return;
            throw error;
        }
        const resuming = response.status === 206;
        const total = Number(response.headers['content-length'] ?? 0) + (resuming ? existingSize : 0);
        await new Promise<void>((resolve, reject) => {
            const writer = fs.createWriteStream(archivePath, resuming ? { flags: 'a' } : {});
            let downloaded = resuming ? existingSize : 0;
            const onAbort = () => {
                writer.destroy();
                reject(new Error(SHERPA_TTS_DOWNLOAD_CANCELLED_MESSAGE));
            };
            if (signal.aborted) return onAbort();
            signal.addEventListener('abort', onAbort, { once: true });
            response.data.on('data', (chunk: Buffer) => {
                downloaded += chunk.length;
                this.currentPercent = total > 0 ? Math.floor(downloaded / total * 100) : 0;
                this.rendererGateway.fireAndForget('settings/sherpa-tts-model-download-progress', {
                    percent: this.currentPercent,
                    downloaded,
                    total,
                    phase: 'downloading',
                });
            });
            response.data.on('error', reject);
            writer.on('finish', () => {
                signal.removeEventListener('abort', onAbort);
                resolve();
            });
            writer.on('error', reject);
            response.data.pipe(writer);
        });
    }

    /** @param archivePath 归档路径 @returns 已有归档大小。 */
    private async getExistingArchiveSize(archivePath: string): Promise<number> {
        try {
            const stat = await fsPromises.stat(archivePath);
            return stat.isFile() ? stat.size : 0;
        } catch {
            return 0;
        }
    }

    /** @param phase 下载阶段 */
    private emitPhase(phase: ParakeetModelPhase): void {
        this.currentPercent = 100;
        this.currentPhase = phase;
        this.rendererGateway.fireAndForget('settings/sherpa-tts-model-download-progress', {
            percent: 100,
            downloaded: 0,
            total: 0,
            phase,
        });
    }

    /** @returns TTS 模型安装目录。 */
    private async getModelPath(): Promise<string> {
        const modelsRoot = await this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.MODELS);
        return path.join(modelsRoot, SHERPA_TTS_MODEL_DIRECTORY);
    }

    /** @param extractPath 解压目录 @returns 包含完整模型文件的目录。 */
    private async findModelDirectory(extractPath: string): Promise<string> {
        const entries = await fsPromises.readdir(extractPath, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const candidate = path.join(extractPath, entry.name);
            if (SHERPA_TTS_REQUIRED_FILES.every((file) => fs.existsSync(path.join(candidate, file)))) return candidate;
        }
        if (SHERPA_TTS_REQUIRED_FILES.every((file) => fs.existsSync(path.join(extractPath, file)))) return extractPath;
        throw new Error('TTS 模型归档中未找到完整模型目录');
    }

    /** @param sourceDir 已校验目录 @param targetDir 安装目录 */
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
