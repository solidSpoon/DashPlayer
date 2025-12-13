import registerRoute from '@/common/api/register';
import Controller from '@/backend/interfaces/controller';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import SystemService from '@/backend/services/SystemService';
import { getMainLogger } from '@/backend/ioc/simple-logger';
import LocationUtil from '@/backend/utils/LocationUtil';
import axios from 'axios';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import * as tar from 'tar';
import { KokoroModelVariant, TtsModelStatusVO } from '@/common/types/vo/tts-model-vo';

@injectable()
export class TtsModelController implements Controller {
    @inject(TYPES.SystemService) private systemService!: SystemService;
    private logger = getMainLogger('TtsModelController');

    private getModelsRoot(): string {
        return LocationUtil.staticGetStoragePath('models');
    }

    private getEchogardenHomeDir(): string {
        return path.join(this.getModelsRoot(), 'echogarden-home');
    }

    private getEchogardenDataDir(homeDir: string): string {
        const platform = process.platform;
        if (platform === 'win32') {
            return path.join(homeDir, 'AppData', 'Local', 'echogarden');
        }
        if (platform === 'darwin') {
            return path.join(homeDir, 'Library', 'Application Support', 'echogarden');
        }
        if (platform === 'linux') {
            return path.join(homeDir, '.local', 'share', 'echogarden');
        }
        return path.join(homeDir, '.local', 'share', 'echogarden');
    }

    private getEchogardenPackagesDir(homeDir: string): string {
        return path.join(this.getEchogardenDataDir(homeDir), 'packages');
    }

    private async resolvePackageName(unversionedName: string): Promise<string> {
        const mod = await import('echogarden/dist/utilities/PackageManager.js');
        return mod.resolveToVersionedPackageNameIfNeeded(unversionedName);
    }

    private async getPackageBaseURL(): Promise<string> {
        const { getGlobalOption } = await import('echogarden/dist/api/GlobalOptions.js');
        return getGlobalOption('packageBaseURL');
    }

    private async downloadTarball(url: string, destPath: string, progressKey: string): Promise<void> {
        return this.downloadTarballScaled(url, destPath, progressKey, 0, 100);
    }

    private async downloadTarballScaled(url: string, destPath: string, progressKey: string, basePercent: number, spanPercent: number): Promise<void> {
        if (fs.existsSync(destPath)) return;

        await fsPromises.mkdir(path.dirname(destPath), { recursive: true });
        const tempPath = `${destPath}.tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`;

        const response = await axios.get(url, { responseType: 'stream' });
        const total = Number(response.headers['content-length'] ?? 0) || 0;

        await new Promise<void>((resolve, reject) => {
            const writer = fs.createWriteStream(tempPath);
            let downloaded = 0;
            let lastEmittedPercent = -1;
            let lastEmitAt = 0;

            response.data.on('data', (chunk: Buffer) => {
                downloaded += chunk.length;
                if (!total) return;
                const percentRaw = Math.max(0, Math.min(100, Math.floor((downloaded / total) * 100)));
                const percent = Math.max(0, Math.min(100, Math.floor(basePercent + (percentRaw * spanPercent / 100))));
                const now = Date.now();
                if (percent === lastEmittedPercent && now - lastEmitAt < 500) return;
                lastEmittedPercent = percent;
                lastEmitAt = now;
                this.systemService.callRendererApi('settings/tts-model-download-progress', {
                    key: progressKey,
                    percent,
                    downloaded,
                    total,
                });
            });

            response.data.pipe(writer);
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        await fsPromises.rename(tempPath, destPath);
        this.systemService.callRendererApi('settings/tts-model-download-progress', {
            key: progressKey,
            percent: Math.max(0, Math.min(100, Math.floor(basePercent + spanPercent))),
            downloaded: total || undefined,
            total: total || undefined,
        });
    }

    private async ensurePackage(unversionedName: string): Promise<string> {
        return this.ensurePackageWithProgress(unversionedName, `tts:${unversionedName}`, 0, 100);
    }

    private async ensurePackageWithProgress(unversionedName: string, progressKey: string, basePercent: number, spanPercent: number): Promise<string> {
        const homeDir = this.getEchogardenHomeDir();
        const packagesDir = this.getEchogardenPackagesDir(homeDir);
        await fsPromises.mkdir(packagesDir, { recursive: true });

        const versionedName = await this.resolvePackageName(unversionedName);
        const packagePath = path.join(packagesDir, versionedName);
        if (fs.existsSync(packagePath)) return packagePath;

        const baseURL = await this.getPackageBaseURL();
        const url = `${baseURL}${versionedName}.tar.gz`;
        const tarballPath = path.join(packagesDir, `${versionedName}.tar.gz`);

        this.logger.info('Downloading echogarden package', { unversionedName, versionedName, url });
        await this.downloadTarballScaled(url, tarballPath, progressKey, basePercent, spanPercent);

        this.logger.info('Extracting echogarden package', { versionedName, packagesDir });
        await tar.x({ file: tarballPath, cwd: packagesDir });
        await fsPromises.rm(tarballPath, { force: true });

        return packagePath;
    }

    public async getStatus(): Promise<TtsModelStatusVO> {
        const modelsRoot = this.getModelsRoot();
        const echogardenHomeDir = this.getEchogardenHomeDir();
        const echogardenPackagesDir = this.getEchogardenPackagesDir(echogardenHomeDir);

        const voicesName = await this.resolvePackageName('kokoro-82m-v1.0-voices');
        const quantizedName = await this.resolvePackageName('kokoro-82m-v1.0-quantized');
        const fp32Name = await this.resolvePackageName('kokoro-82m-v1.0-fp32');

        const voicesPath = path.join(echogardenPackagesDir, voicesName);
        const quantizedPath = path.join(echogardenPackagesDir, quantizedName);
        const fp32Path = path.join(echogardenPackagesDir, fp32Name);

        return {
            modelsRoot,
            echogardenHomeDir,
            echogardenPackagesDir,
            kokoro: {
                voices: { exists: fs.existsSync(voicesPath), path: voicesPath },
                quantized: { exists: fs.existsSync(quantizedPath), path: quantizedPath },
                fp32: { exists: fs.existsSync(fp32Path), path: fp32Path },
            },
        };
    }

    public async downloadKokoro(params: { variant: KokoroModelVariant }): Promise<{ success: boolean; message: string }> {
        const variant: KokoroModelVariant = params.variant === 'fp32' ? 'fp32' : 'quantized';

        const progressKey = 'tts:kokoro';
        await this.ensurePackageWithProgress('kokoro-82m-v1.0-voices', progressKey, 0, 50);
        if (variant === 'fp32') {
            await this.ensurePackageWithProgress('kokoro-82m-v1.0-fp32', progressKey, 50, 50);
        } else {
            await this.ensurePackageWithProgress('kokoro-82m-v1.0-quantized', progressKey, 50, 50);
        }

        return { success: true, message: `Kokoro 模型已下载：${variant}` };
    }

    registerRoutes(): void {
        registerRoute('tts/models/status', () => this.getStatus());
        registerRoute('tts/models/download', (p: { variant: KokoroModelVariant }) => this.downloadKokoro(p));
    }
}
