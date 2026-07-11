import axios from 'axios';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import * as tarFs from 'tar-fs';
import unbzip2Stream from 'unbzip2-stream';
import { inject, injectable } from 'inversify';
import RendererGateway from '@/backend/application/ports/gateways/renderer/RendererGateway';
import StorageDirectoryProvider, { StorageDirectoryTarget } from '@/backend/application/ports/gateways/storage/StorageDirectoryProvider';
import TYPES from '@/backend/ioc/types';
import { ParakeetModelStatusVO } from '@/common/types/vo/parakeet-model-vo';
import { PARAKEET_MODEL_DIRECTORY, PARAKEET_REQUIRED_FILES } from '@/backend/application/contracts/parakeetModel';

const ARCHIVE_URL = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8.tar.bz2';

/**
 * 负责 Parakeet v3 模型状态检查、下载和原子安装。
 */
@injectable()
export class ParakeetModelService {
    private activeDownload: Promise<{ success: boolean; message: string }> | null = null;

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
        return { modelPath, ready: missingFiles.length === 0, missingFiles: [...missingFiles] };
    }

    /**
     * 下载官方 INT8 模型归档并完成原子安装。
     * @returns 下载操作结果。
     */
    public async download(): Promise<{ success: boolean; message: string }> {
        if (this.activeDownload) return this.activeDownload;
        this.activeDownload = this.performDownload();
        try {
            return await this.activeDownload;
        } finally {
            this.activeDownload = null;
        }
    }

    /**
     * 执行一次模型下载、校验与目录切换。
     * @returns 下载操作结果。
     */
    private async performDownload(): Promise<{ success: boolean; message: string }> {
        const current = await this.getStatus();
        if (current.ready) return { success: true, message: 'Parakeet v3 模型已就绪' };

        const modelsRoot = await this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.MODELS);
        const workDir = path.join(modelsRoot, `.parakeet-download-${Date.now()}`);
        const archivePath = path.join(workDir, 'model.tar.bz2');
        const extractPath = path.join(workDir, 'extract');
        await fsPromises.mkdir(extractPath, { recursive: true });
        try {
            await this.downloadArchive(archivePath);
            await this.extractArchive(archivePath, extractPath);
            const sourceDir = await this.findModelDirectory(extractPath);
            const missingFiles = PARAKEET_REQUIRED_FILES.filter((file) => !fs.existsSync(path.join(sourceDir, file)));
            if (missingFiles.length > 0) throw new Error(`模型归档缺少文件：${missingFiles.join(', ')}`);
            await this.replaceModelDirectory(sourceDir, current.modelPath);
            return { success: true, message: 'Parakeet v3 模型下载完成' };
        } finally {
            await fsPromises.rm(workDir, { recursive: true, force: true });
        }
    }

    /** @returns 固定模型安装目录。 */
    private async getModelPath(): Promise<string> {
        const modelsRoot = await this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.MODELS);
        return path.join(modelsRoot, PARAKEET_MODEL_DIRECTORY);
    }

    /**
     * 流式下载模型归档并上报进度。
     * @param archivePath 临时归档路径。
     */
    private async downloadArchive(archivePath: string): Promise<void> {
        const response = await axios.get(ARCHIVE_URL, { responseType: 'stream' });
        const total = Number(response.headers['content-length'] ?? 0);
        await new Promise<void>((resolve, reject) => {
            const writer = fs.createWriteStream(archivePath);
            let downloaded = 0;
            response.data.on('data', (chunk: Buffer) => {
                downloaded += chunk.length;
                const percent = total > 0 ? Math.floor(downloaded / total * 100) : 0;
                this.rendererGateway.fireAndForget('settings/parakeet-model-download-progress', { percent, downloaded, total });
            });
            response.data.on('error', reject);
            response.data.pipe(writer);
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
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
