import axios, { isAxiosError } from 'axios';
import { execFile } from 'child_process';
import { createHash } from 'crypto';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';
import { promisify } from 'util';
import { createGunzip } from 'zlib';
import * as tarFs from 'tar-fs';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import { getMainLogger } from '@/backend/infrastructure/logger';
import type RendererGateway from '@/backend/services/gateways/renderer/RendererGateway';
import type StorageDirectoryProvider from '@/backend/services/gateways/storage/StorageDirectoryProvider';
import { StorageDirectoryTarget } from '@/backend/services/gateways/storage/StorageDirectoryProvider';
import type { PiRuntimeDownloadPhase, PiRuntimeStatusVO } from '@/common/contracts/pi-runtime';

const execFileAsync = promisify(execFile);

const PI_LATEST_RELEASE_API = 'https://api.github.com/repos/earendil-works/pi/releases/latest';
const DOWNLOAD_WORK_DIR_NAME = '.pi-download';
const INSTALL_DIR_NAME = 'pi';
const AGENT_CONFIG_DIR_NAME = 'pi-agent';
const INSTALL_META_FILE = '.dashplayer-pi-meta.json';

interface GitHubReleaseAsset {
    name: string;
    browser_download_url: string;
    size: number;
}

interface GitHubLatestRelease {
    tag_name: string;
    assets: GitHubReleaseAsset[];
}

interface PiInstallMetadata {
    version: string;
    platformKey: string;
    installedAt: string;
}

interface PlatformAssetSpec {
    platformKey: string;
    assetName: string;
    archiveKind: 'tar.gz' | 'zip';
    executableName: string;
}

/**
 * 解析当前系统对应的 Pi 官方预编译资产规格。
 * @param platform Node 运行平台。
 * @param arch CPU 架构。
 * @returns 匹配的资产规格；不支持的平台返回 null。
 */
export function resolvePiPlatformAssetSpec(
    platform: NodeJS.Platform = process.platform,
    arch: string = process.arch,
): PlatformAssetSpec | null {
    const platformKey = `${platform}-${arch}`;
    switch (platformKey) {
        case 'darwin-arm64':
            return { platformKey, assetName: 'pi-darwin-arm64.tar.gz', archiveKind: 'tar.gz', executableName: 'pi' };
        case 'darwin-x64':
            return { platformKey, assetName: 'pi-darwin-x64.tar.gz', archiveKind: 'tar.gz', executableName: 'pi' };
        case 'linux-arm64':
            return { platformKey, assetName: 'pi-linux-arm64.tar.gz', archiveKind: 'tar.gz', executableName: 'pi' };
        case 'linux-x64':
            return { platformKey, assetName: 'pi-linux-x64.tar.gz', archiveKind: 'tar.gz', executableName: 'pi' };
        case 'win32-arm64':
            return { platformKey, assetName: 'pi-windows-arm64.zip', archiveKind: 'zip', executableName: 'pi.exe' };
        case 'win32-x64':
            return { platformKey, assetName: 'pi-windows-x64.zip', archiveKind: 'zip', executableName: 'pi.exe' };
        default:
            return null;
    }
}

/**
 * Pi 二进制运行环境管理服务接口。
 */
export default interface PiRuntimeService {
    /** 查询当前受管 Pi 运行环境状态。 */
    getStatus(): Promise<PiRuntimeStatusVO>;
    /** 下载并安装最新官方 Pi 二进制运行环境。 */
    download(): Promise<{ success: boolean; message: string }>;
    /** 取消正在进行的 Pi 运行环境下载。 */
    cancelDownload(): void;
    /** 卸载已安装的受管 Pi 运行环境。 */
    remove(): Promise<void>;
    /** 获取受管 Pi 可执行文件绝对路径；未安装时直接抛错。 */
    requireExecutablePath(): Promise<string>;
    /** 获取隔离的 Pi Agent 配置目录（PI_CODING_AGENT_DIR）。 */
    getIsolatedAgentDir(): Promise<string>;
}

/**
 * Pi 二进制运行环境管理服务实现。
 *
 * 严格将二进制下载并安装在应用受管目录（`<storage.path>/runtimes/pi`），
 * 绝不回退或调用用户系统 PATH 中的 `pi`。
 */
@injectable()
export class PiRuntimeServiceImpl implements PiRuntimeService {
    private readonly logger = getMainLogger('PiRuntimeService');

    private activeDownload: Promise<{ success: boolean; message: string }> | null = null;
    private activeAbortController: AbortController | null = null;
    private currentPhase: PiRuntimeDownloadPhase = 'idle';
    private currentPercent = 0;

    constructor(
        @inject(TYPES.RendererGateway) private readonly rendererGateway: RendererGateway,
        @inject(TYPES.StorageDirectoryProvider) private readonly storageDirectoryProvider: StorageDirectoryProvider,
    ) {}

    /**
     * 查询受管 Pi 运行环境的安装状态与下载进度。
     */
    public async getStatus(): Promise<PiRuntimeStatusVO> {
        const spec = resolvePiPlatformAssetSpec();
        const runtimesDir = await this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.RUNTIMES);
        const installDir = path.join(runtimesDir, INSTALL_DIR_NAME);
        const platformKey = `${process.platform}-${process.arch}`;

        if (!spec) {
            return {
                platformSupported: false,
                platformKey,
                installed: false,
                version: null,
                executablePath: null,
                installDir,
                downloading: false,
                phase: 'idle',
                percent: 0,
                message: `当前系统架构 (${platformKey}) 暂不支持自动下载官方 Pi 二进制`,
            };
        }

        const executablePath = path.join(installDir, spec.executableName);
        const installed = await this.isFileAccessible(executablePath);
        const version = installed ? await this.readInstalledVersion(installDir) : null;

        return {
            platformSupported: true,
            platformKey: spec.platformKey,
            installed,
            version,
            executablePath: installed ? executablePath : null,
            installDir,
            downloading: this.activeDownload !== null,
            phase: this.currentPhase,
            percent: this.currentPercent,
        };
    }

    /**
     * 下载并安装官方 Pi 二进制包；若已在下载则复用进行中的任务。
     */
    public async download(): Promise<{ success: boolean; message: string }> {
        if (this.activeDownload) {
            return await this.activeDownload;
        }

        const spec = resolvePiPlatformAssetSpec();
        if (!spec) {
            return {
                success: false,
                message: `当前系统 (${process.platform}-${process.arch}) 暂不支持下载 Pi 运行环境`,
            };
        }

        const controller = new AbortController();
        this.activeAbortController = controller;
        const task = this.performDownload(spec, controller.signal);
        this.activeDownload = task;

        try {
            return await task;
        } finally {
            if (this.activeDownload === task) {
                this.activeDownload = null;
            }
            if (this.activeAbortController === controller) {
                this.activeAbortController = null;
            }
            this.currentPhase = 'idle';
            this.currentPercent = 0;
            this.emitProgress(0, 0, 0, 'idle');
        }
    }

    /**
     * 取消当前下载任务。
     */
    public cancelDownload(): void {
        if (this.activeAbortController) {
            this.logger.info('cancel pi runtime download');
            this.activeAbortController.abort();
        }
    }

    /**
     * 删除受管目录中的 Pi 运行环境。
     */
    public async remove(): Promise<void> {
        if (this.activeDownload) {
            throw new Error('正在下载 Pi 运行环境，请先取消下载后再删除');
        }
        const runtimesDir = await this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.RUNTIMES);
        const installDir = path.join(runtimesDir, INSTALL_DIR_NAME);
        await fsp.rm(installDir, { recursive: true, force: true });
        this.logger.info('removed pi runtime', { installDir });
    }

    /**
     * 获取受管 Pi 可执行文件路径；未安装时直接抛出显式错误。
     */
    public async requireExecutablePath(): Promise<string> {
        const status = await this.getStatus();
        if (!status.installed || !status.executablePath) {
            throw new Error('Pi 运行环境尚未安装，请先在「设置 → 服务与资源」中下载安装');
        }
        return status.executablePath;
    }

    /**
     * 获取并确保隔离的 Pi 配置目录存在（用于 PI_CODING_AGENT_DIR）。
     */
    public async getIsolatedAgentDir(): Promise<string> {
        const runtimesDir = await this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.RUNTIMES);
        const agentDir = path.join(runtimesDir, AGENT_CONFIG_DIR_NAME);
        await fsp.mkdir(agentDir, { recursive: true });
        return agentDir;
    }

    private async performDownload(
        spec: PlatformAssetSpec,
        signal: AbortSignal,
    ): Promise<{ success: boolean; message: string }> {
        const runtimesDir = await this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.RUNTIMES);
        const workDir = path.join(runtimesDir, DOWNLOAD_WORK_DIR_NAME);
        const installDir = path.join(runtimesDir, INSTALL_DIR_NAME);
        const archivePath = path.join(workDir, spec.assetName);
        const extractDir = path.join(workDir, 'extracted');

        try {
            await fsp.rm(workDir, { recursive: true, force: true });
            await fsp.mkdir(workDir, { recursive: true });

            this.updateProgress(0, 0, 0, 'resolving');
            const release = await this.fetchLatestRelease(signal);
            const asset = release.assets.find((item) => item.name === spec.assetName);
            if (!asset) {
                throw new Error(`Pi 最新版本 (${release.tag_name}) 未提供对应平台包：${spec.assetName}`);
            }

            const checksumAsset = release.assets.find((item) => item.name === 'SHA256SUMS');
            const expectedSha256 = checksumAsset
                ? await this.fetchExpectedSha256(checksumAsset.browser_download_url, spec.assetName, signal)
                : null;

            this.logger.info('start downloading pi runtime', {
                version: release.tag_name,
                asset: spec.assetName,
                url: asset.browser_download_url,
            });

            await this.downloadFile(asset.browser_download_url, archivePath, asset.size, signal);

            if (expectedSha256) {
                this.updateProgress(100, asset.size, asset.size, 'verifying');
                const actualSha256 = await this.computeFileSha256(archivePath);
                if (actualSha256 !== expectedSha256) {
                    throw new Error(`Pi 安装包校验失败（SHA256 不匹配）：期望 ${expectedSha256}，实际 ${actualSha256}`);
                }
            }

            this.updateProgress(100, asset.size, asset.size, 'extracting');
            await fsp.mkdir(extractDir, { recursive: true });
            await this.extractArchive(archivePath, extractDir, spec.archiveKind);

            const sourceDir = await this.resolveExtractedRoot(extractDir, spec.executableName);
            const targetBinary = path.join(sourceDir, spec.executableName);
            if (process.platform !== 'win32') {
                await fsp.chmod(targetBinary, 0o755);
            }

            const meta: PiInstallMetadata = {
                version: release.tag_name,
                platformKey: spec.platformKey,
                installedAt: new Date().toISOString(),
            };
            await fsp.writeFile(path.join(sourceDir, INSTALL_META_FILE), JSON.stringify(meta, null, 2), 'utf8');

            const stagingBackup = path.join(runtimesDir, `${INSTALL_DIR_NAME}.bak-${Date.now()}`);
            const hadExisting = await this.pathExists(installDir);
            if (hadExisting) {
                await fsp.rename(installDir, stagingBackup);
            }
            try {
                await fsp.rename(sourceDir, installDir);
                if (hadExisting) {
                    await fsp.rm(stagingBackup, { recursive: true, force: true });
                }
            } catch (swapError) {
                if (hadExisting && (await this.pathExists(stagingBackup)) && !(await this.pathExists(installDir))) {
                    await fsp.rename(stagingBackup, installDir);
                }
                throw swapError;
            }

            await fsp.rm(workDir, { recursive: true, force: true });
            this.logger.info('pi runtime installed successfully', { version: release.tag_name, installDir });
            return { success: true, message: `Pi ${release.tag_name} 安装成功` };
        } catch (error) {
            await fsp.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
            if (signal.aborted || (isAxiosError(error) && error.code === 'ERR_CANCELED')) {
                return { success: false, message: '已取消下载 Pi 运行环境' };
            }
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error('pi runtime download failed', { error: message });
            return { success: false, message: `下载 Pi 运行环境失败：${message}` };
        }
    }

    private async fetchLatestRelease(signal: AbortSignal): Promise<GitHubLatestRelease> {
        const response = await axios.get<GitHubLatestRelease>(PI_LATEST_RELEASE_API, {
            signal,
            timeout: 20_000,
            headers: {
                Accept: 'application/vnd.github+json',
                'User-Agent': 'DashPlayer',
            },
        });
        if (!response.data || !Array.isArray(response.data.assets)) {
            throw new Error('GitHub Release 响应格式异常');
        }
        return response.data;
    }

    private async fetchExpectedSha256(
        checksumUrl: string,
        assetName: string,
        signal: AbortSignal,
    ): Promise<string | null> {
        const response = await axios.get<string>(checksumUrl, {
            signal,
            timeout: 15_000,
            responseType: 'text',
            headers: { 'User-Agent': 'DashPlayer' },
        });
        const lines = String(response.data).split(/\r?\n/);
        for (const line of lines) {
            const match = line.trim().match(/^([a-fA-F0-9]{64})\s+\*?(.+)$/);
            if (match && path.basename(match[2].trim()) === assetName) {
                return match[1].toLowerCase();
            }
        }
        return null;
    }

    private async downloadFile(
        url: string,
        destPath: string,
        fallbackTotal: number,
        signal: AbortSignal,
    ): Promise<void> {
        const maxAttempts = 3;
        let lastError: unknown;

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            try {
                await this.downloadFileOnce(url, destPath, fallbackTotal, signal);
                return;
            } catch (error) {
                lastError = error;
                if (signal.aborted) {
                    throw error;
                }
                await fsp.rm(destPath, { force: true }).catch(() => undefined);
                if (attempt < maxAttempts) {
                    this.logger.warn('pi runtime download interrupted, retrying', {
                        attempt,
                        error: error instanceof Error ? error.message : String(error),
                    });
                    this.updateProgress(0, 0, fallbackTotal, 'downloading');
                }
            }
        }
        throw lastError;
    }

    private async downloadFileOnce(
        url: string,
        destPath: string,
        fallbackTotal: number,
        signal: AbortSignal,
    ): Promise<void> {
        // 使用无活动超时替代固定总时长超时，避免大文件慢速下载在 60 秒时被误杀
        const attemptController = new AbortController();
        const onParentAbort = () => attemptController.abort();
        signal.addEventListener('abort', onParentAbort, { once: true });

        let inactivityTimer: NodeJS.Timeout | null = null;
        const resetInactivityTimer = () => {
            if (inactivityTimer) {
                clearTimeout(inactivityTimer);
            }
            inactivityTimer = setTimeout(() => {
                attemptController.abort();
            }, 45_000);
            inactivityTimer.unref?.();
        };

        try {
            resetInactivityTimer();
            const response = await axios.get<NodeJS.ReadableStream>(url, {
                signal: attemptController.signal,
                responseType: 'stream',
                timeout: 0,
                maxRedirects: 5,
                headers: { 'User-Agent': 'DashPlayer' },
            });

            const headerLength = Number(response.headers['content-length'] ?? 0);
            const total = headerLength > 0 ? headerLength : fallbackTotal;
            let downloaded = 0;
            let lastEmitAt = 0;

            response.data.on('data', (chunk: Buffer) => {
                resetInactivityTimer();
                downloaded += chunk.length;
                const now = Date.now();
                if (now - lastEmitAt >= 120 || (total > 0 && downloaded >= total)) {
                    lastEmitAt = now;
                    const percent = total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : 0;
                    this.updateProgress(percent, downloaded, total, 'downloading');
                }
            });

            await pipeline(response.data, fs.createWriteStream(destPath));
            this.updateProgress(100, downloaded, total || downloaded, 'downloading');
        } finally {
            if (inactivityTimer) {
                clearTimeout(inactivityTimer);
            }
            signal.removeEventListener('abort', onParentAbort);
        }
    }

    private async computeFileSha256(filePath: string): Promise<string> {
        const hash = createHash('sha256');
        await pipeline(fs.createReadStream(filePath), hash);
        return hash.digest('hex').toLowerCase();
    }

    private async extractArchive(
        archivePath: string,
        destDir: string,
        kind: 'tar.gz' | 'zip',
    ): Promise<void> {
        if (kind === 'tar.gz') {
            await pipeline(
                fs.createReadStream(archivePath),
                createGunzip(),
                tarFs.extract(destDir),
            );
            return;
        }

        if (process.platform === 'win32') {
            const escapedZip = archivePath.replace(/'/g, "''");
            const escapedDest = destDir.replace(/'/g, "''");
            await execFileAsync('powershell.exe', [
                '-NoProfile',
                '-NonInteractive',
                '-Command',
                `Expand-Archive -Force -LiteralPath '${escapedZip}' -DestinationPath '${escapedDest}'`,
            ]);
            return;
        }

        await execFileAsync('unzip', ['-o', '-q', archivePath, '-d', destDir]);
    }

    private async resolveExtractedRoot(extractDir: string, executableName: string): Promise<string> {
        const directBinary = path.join(extractDir, executableName);
        if (await this.isFileAccessible(directBinary)) {
            return extractDir;
        }
        const nestedDir = path.join(extractDir, 'pi');
        const nestedBinary = path.join(nestedDir, executableName);
        if (await this.isFileAccessible(nestedBinary)) {
            return nestedDir;
        }
        throw new Error(`解压后未找到 Pi 可执行文件 (${executableName})`);
    }

    private async readInstalledVersion(installDir: string): Promise<string | null> {
        try {
            const metaRaw = await fsp.readFile(path.join(installDir, INSTALL_META_FILE), 'utf8');
            const meta = JSON.parse(metaRaw) as Partial<PiInstallMetadata>;
            if (typeof meta.version === 'string' && meta.version.trim().length > 0) {
                return meta.version.trim();
            }
        } catch {
            // 忽略，尝试读取包内 package.json
        }
        try {
            const pkgRaw = await fsp.readFile(path.join(installDir, 'package.json'), 'utf8');
            const pkg = JSON.parse(pkgRaw) as { version?: unknown };
            if (typeof pkg.version === 'string' && pkg.version.trim().length > 0) {
                return `v${pkg.version.trim()}`;
            }
        } catch {
            // 忽略
        }
        return null;
    }

    private async isFileAccessible(targetPath: string): Promise<boolean> {
        try {
            const stat = await fsp.stat(targetPath);
            return stat.isFile();
        } catch {
            return false;
        }
    }

    private async pathExists(targetPath: string): Promise<boolean> {
        try {
            await fsp.access(targetPath);
            return true;
        } catch {
            return false;
        }
    }

    private updateProgress(
        percent: number,
        downloaded: number,
        total: number,
        phase: PiRuntimeDownloadPhase,
    ): void {
        this.currentPercent = percent;
        this.currentPhase = phase;
        this.emitProgress(percent, downloaded, total, phase);
    }

    private emitProgress(
        percent: number,
        downloaded: number,
        total: number,
        phase: PiRuntimeDownloadPhase,
    ): void {
        this.rendererGateway.fireAndForget('settings/pi-runtime-download-progress', {
            percent,
            downloaded,
            total,
            phase,
        });
    }
}
