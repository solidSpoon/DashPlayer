import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { PassThrough } from 'stream';
import axios, { AxiosError, AxiosResponse } from 'axios';
import { ModelArchiveInstaller, ModelArchiveInstallerOptions } from '@/backend/services/models/ModelArchiveInstaller';
import RendererGateway from '@/backend/services/gateways/renderer/RendererGateway';
import StorageDirectoryProvider from '@/backend/services/gateways/storage/StorageDirectoryProvider';
import FileSystemGatewayImpl from '@/backend/infrastructure/storage/FileSystemGatewayImpl';
import { MemoryFileSystemGateway } from '@/test/memory-file-system-gateway';

// 日志模块是系统边界：测试里静音，避免真实落盘和对 Electron app 的依赖。
vi.mock('@/backend/infrastructure/logger', () => ({
    getMainLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
}));

/**
 * 渲染层网关测试替身：记录广播事件，不触达真实 IPC。
 */
class RecordingRendererGateway implements RendererGateway {
    /** 按顺序记录的广播事件。 */
    public readonly events: Array<{ path: string; params: unknown }> = [];

    public async call(): Promise<void> {
        throw new Error('测试替身不处理后端调用前端');
    }

    public fireAndForget(path: string, params: unknown): void {
        this.events.push({ path, params });
    }
}

/**
 * 目录提供器测试替身：固定返回构造时指定的 models 根目录。
 */
class FixedStorageDirectoryProvider implements StorageDirectoryProvider {
    constructor(private readonly rootPath: string = path.join('/', 'models')) {}

    public async provideDirectory(): Promise<string> {
        return this.rootPath;
    }

    public async ensurePathAccessPermissionIfExists(): Promise<void> {
        // 测试场景不模拟权限恢复
    }

    public async getRootStatus(): Promise<never> {
        throw new Error('测试替身不提供目录状态');
    }
}

/** 暴露受保护方法的安装器，便于直接测试目录定位与替换逻辑。 */
class ExposedModelArchiveInstaller extends ModelArchiveInstaller {
    public async findModelDirectoryForTest(extractPath: string): Promise<string> {
        return this.findModelDirectory(extractPath);
    }

    public async replaceModelDirectoryForTest(sourceDir: string, targetDir: string): Promise<void> {
        return this.replaceModelDirectory(sourceDir, targetDir);
    }
}

/** 测试用安装配置。 */
const INSTALLER_OPTIONS: ModelArchiveInstallerOptions = {
    downloadUrls: ['https://example.com/model.tar.bz2'],
    workDirectoryName: '.test-download',
    archiveFileName: 'model.tar.bz2',
    modelDirectoryName: 'test-model',
    requiredFiles: ['model.onnx', 'tokens.txt'],
    progressEventName: 'settings/parakeet-model-download-progress',
    cancelledMessage: '测试模型下载已取消',
    modelDisplayName: '测试模型',
};

/** 在内存网关中预置一个完整安装的模型目录。 */
async function installCompleteModel(gateway: MemoryFileSystemGateway): Promise<string> {
    const modelPath = path.join('/', 'models', 'test-model');
    await gateway.ensureDirectory(modelPath);
    for (const file of INSTALLER_OPTIONS.requiredFiles) {
        await gateway.writeTextFile(path.join(modelPath, file), 'content');
    }
    return modelPath;
}

describe('模型归档安装器', () => {
    let gateway: MemoryFileSystemGateway;
    let rendererGateway: RecordingRendererGateway;
    let installer: ExposedModelArchiveInstaller;

    beforeEach(() => {
        gateway = new MemoryFileSystemGateway();
        rendererGateway = new RecordingRendererGateway();
        installer = new ExposedModelArchiveInstaller(
            INSTALLER_OPTIONS,
            rendererGateway,
            new FixedStorageDirectoryProvider(),
            gateway,
        );
    });

    describe('查询安装状态', () => {
        it('模型未安装时报告全部必需文件缺失', async () => {
            const status = await installer.getStatus();

            expect(status.ready).toBe(false);
            expect(status.missingFiles).toEqual(['model.onnx', 'tokens.txt']);
            expect(status.modelPath).toBe(path.join('/', 'models', 'test-model'));
            expect(status.archivePath).toBe(path.join('/', 'models', '.test-download', 'model.tar.bz2'));
            expect(status.downloading).toBe(false);
            expect(status.phase).toBeNull();
        });

        it('必需文件齐全时返回就绪', async () => {
            const modelPath = await installCompleteModel(gateway);

            const status = await installer.getStatus();

            expect(status.ready).toBe(true);
            expect(status.missingFiles).toEqual([]);
            expect(status.modelPath).toBe(modelPath);
        });
    });

    describe('下载', () => {
        it('模型已就绪时直接返回成功，不发起网络请求', async () => {
            await installCompleteModel(gateway);

            const result = await installer.download();

            expect(result.success).toBe(true);
            expect(result.message).toBe('测试模型 模型已就绪');
            // 下载结束时向前端广播 idle 终态
            expect(rendererGateway.events).toContainEqual({
                path: 'settings/parakeet-model-download-progress',
                params: { percent: 0, downloaded: 0, total: 0, phase: 'idle' },
            });
        });

        it('无下载任务时取消返回未取消', async () => {
            expect(await installer.cancelDownload()).toEqual({ cancelled: false });
        });
    });

    describe('多地址下载与镜像回退', () => {
        const OFFICIAL_URL = 'https://official.example.com/ggml.bin';
        const MIRROR_URL = 'https://mirror.example.com/ggml.bin';
        const RAW_BODY = 'ggml-model-content';

        /** raw 形态多地址配置：归档即模型文件本身，与 whisper.cpp GGUF 模型一致。 */
        const rawOptions: ModelArchiveInstallerOptions = {
            downloadUrls: [OFFICIAL_URL, MIRROR_URL],
            workDirectoryName: '.test-download',
            archiveFileName: 'model.bin',
            archiveKind: 'raw',
            modelDirectoryName: 'test-raw-model',
            requiredFiles: ['model.bin'],
            progressEventName: 'settings/parakeet-model-download-progress',
            cancelledMessage: '测试模型下载已取消',
            modelDisplayName: '测试模型',
        };

        let tmpRoot: string;

        beforeEach(() => {
            // 下载链路直接用 Node 流写盘，必须用真实文件系统与网关保持同一视图
            tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dashplayer-model-installer-'));
        });

        afterEach(() => {
            vi.restoreAllMocks();
            fs.rmSync(tmpRoot, { recursive: true, force: true });
        });

        /** 用真实文件系统构建 raw 形态安装器。 */
        function createRawInstaller(options: ModelArchiveInstallerOptions = rawOptions): ExposedModelArchiveInstaller {
            return new ExposedModelArchiveInstaller(
                options,
                rendererGateway,
                new FixedStorageDirectoryProvider(tmpRoot),
                new FileSystemGatewayImpl(),
            );
        }

        /** 已安装模型文件的真实路径（models 根目录即 tmpRoot）。 */
        function installedModelPath(): string {
            return path.join(tmpRoot, rawOptions.modelDirectoryName, rawOptions.archiveFileName);
        }

        /** 工作目录中归档文件的真实路径。 */
        function workArchivePath(): string {
            return path.join(tmpRoot, rawOptions.workDirectoryName, rawOptions.archiveFileName);
        }

        /** 将 axios.head 打桩为按清单决定地址可达性。 */
        function mockHead(reachableUrls: string[]): void {
            vi.spyOn(axios, 'head').mockImplementation(async (url: string) => {
                if (!reachableUrls.includes(url)) throw new Error('connection refused');
                return { status: 200, statusText: 'OK', headers: {}, data: undefined, config: {} } as unknown as AxiosResponse;
            });
        }

        /** 将 axios.get 打桩为返回一次性写完的流式响应。 */
        function mockDownloadBody(): ReturnType<typeof vi.spyOn> {
            return vi.spyOn(axios, 'get').mockImplementation(async () => {
                const stream = new PassThrough();
                process.nextTick(() => {
                    stream.write(RAW_BODY);
                    stream.end();
                });
                return {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-length': String(RAW_BODY.length) },
                    data: stream,
                    config: {},
                } as unknown as AxiosResponse;
            });
        }

        it('官方与镜像都可达时优先从官方地址下载并安装', async () => {
            mockHead([OFFICIAL_URL, MIRROR_URL]);
            const getSpy = mockDownloadBody();

            const result = await createRawInstaller().download();

            expect(result.success).toBe(true);
            expect(getSpy.mock.calls[0][0]).toBe(OFFICIAL_URL);
            expect(fs.readFileSync(installedModelPath(), 'utf-8')).toBe(RAW_BODY);
        });

        it('官方地址不可达时自动改用镜像地址下载', async () => {
            mockHead([MIRROR_URL]);
            const getSpy = mockDownloadBody();

            const result = await createRawInstaller().download();

            expect(result.success).toBe(true);
            expect(getSpy.mock.calls[0][0]).toBe(MIRROR_URL);
            expect(fs.readFileSync(installedModelPath(), 'utf-8')).toBe(RAW_BODY);
        });

        it('全部地址不可达且本地无归档时报错引导手动下载', async () => {
            mockHead([]);
            const getSpy = mockDownloadBody();

            await expect(createRawInstaller().download()).rejects.toThrow('所有下载地址均无法访问');
            // 报错发生在探测阶段，不应发起任何真实下载请求
            expect(getSpy).not.toHaveBeenCalled();
        });

        it('全部地址不可达但已手动放置完整文件时直接安装成功', async () => {
            mockHead([]);
            vi.spyOn(axios, 'get').mockImplementation(async () => {
                // 手动放置的完整文件发起 Range 请求会被判 416，应直接进入安装校验
                const error = new AxiosError('Range Not Satisfiable', 'ERR_BAD_REQUEST');
                (error as unknown as { response: { status: number } }).response = { status: 416 };
                throw error;
            });
            fs.mkdirSync(path.dirname(workArchivePath()), { recursive: true });
            fs.writeFileSync(workArchivePath(), RAW_BODY);

            const result = await createRawInstaller().download();

            expect(result.success).toBe(true);
            expect(fs.readFileSync(installedModelPath(), 'utf-8')).toBe(RAW_BODY);
        });

        it('只有单个候选地址时无需探测直接下载', async () => {
            const headSpy = vi.spyOn(axios, 'head').mockRejectedValue(new Error('单地址不应发起探测'));
            mockDownloadBody();
            const singleOptions: ModelArchiveInstallerOptions = { ...rawOptions, downloadUrls: [OFFICIAL_URL] };

            const result = await createRawInstaller(singleOptions).download();

            expect(result.success).toBe(true);
            expect(headSpy).not.toHaveBeenCalled();
            expect(fs.readFileSync(installedModelPath(), 'utf-8')).toBe(RAW_BODY);
        });
    });

    describe('删除模型', () => {
        it('删除已安装的模型目录', async () => {
            const modelPath = await installCompleteModel(gateway);

            const result = await installer.deleteModel();

            expect(result.success).toBe(true);
            expect(result.message).toBe('测试模型 模型已删除');
            expect(await gateway.pathIsMissing(modelPath)).toBe(true);
        });
    });

    describe('定位模型目录', () => {
        it('优先返回包含全部必需文件的子目录', async () => {
            const extractPath = path.join('/', 'work', 'extract');
            const innerDir = path.join(extractPath, 'v1');
            await gateway.ensureDirectory(innerDir);
            for (const file of INSTALLER_OPTIONS.requiredFiles) {
                await gateway.writeTextFile(path.join(innerDir, file), 'content');
            }

            expect(await installer.findModelDirectoryForTest(extractPath)).toBe(innerDir);
        });

        it('归档没有外层目录时回退到解压根目录', async () => {
            const extractPath = path.join('/', 'work', 'extract');
            await gateway.ensureDirectory(extractPath);
            for (const file of INSTALLER_OPTIONS.requiredFiles) {
                await gateway.writeTextFile(path.join(extractPath, file), 'content');
            }

            expect(await installer.findModelDirectoryForTest(extractPath)).toBe(extractPath);
        });

        it('必需条目是目录时，目录存在也算就绪', async () => {
            // 回归场景：Sherpa 的 espeak-ng-data 是目录而非文件，
            // 旧实现用严格只认普通文件的 fileExists 检查，导致已安装模型被误报损坏
            const directoryOptions: ModelArchiveInstallerOptions = {
                ...INSTALLER_OPTIONS,
                requiredFiles: ['model.onnx', 'espeak-ng-data'],
            };
            const directoryInstaller = new ExposedModelArchiveInstaller(
                directoryOptions,
                rendererGateway,
                new FixedStorageDirectoryProvider(),
                gateway,
            );
            const modelPath = path.join('/', 'models', 'test-model');
            await gateway.ensureDirectory(modelPath);
            await gateway.writeTextFile(path.join(modelPath, 'model.onnx'), 'content');
            await gateway.ensureDirectory(path.join(modelPath, 'espeak-ng-data'));

            const status = await directoryInstaller.getStatus();

            expect(status.ready).toBe(true);
            expect(status.missingFiles).toEqual([]);
        });

        it('找不到完整模型目录时报错', async () => {
            const extractPath = path.join('/', 'work', 'extract');
            await gateway.ensureDirectory(extractPath);

            await expect(installer.findModelDirectoryForTest(extractPath))
                .rejects.toThrow('测试模型 模型归档中未找到完整模型目录');
        });
    });

    describe('替换模型目录', () => {
        it('替换已有目录并清理备份', async () => {
            const targetDir = path.join('/', 'models', 'test-model');
            const sourceDir = path.join('/', 'work', 'extract', 'v1');
            await gateway.ensureDirectory(targetDir);
            await gateway.writeTextFile(path.join(targetDir, 'old.onnx'), 'old');
            await gateway.ensureDirectory(sourceDir);
            await gateway.writeTextFile(path.join(sourceDir, 'new.onnx'), 'new');

            await installer.replaceModelDirectoryForTest(sourceDir, targetDir);

            expect(await gateway.readTextFile(path.join(targetDir, 'new.onnx'))).toBe('new');
            // 备份目录不应残留
            const remaining = [...gateway.directories].filter(dirPath => dirPath.includes('.backup-'));
            expect(remaining).toEqual([]);
        });

        it('切换失败时回滚到原目录', async () => {
            const targetDir = path.join('/', 'models', 'test-model');
            const missingSourceDir = path.join('/', 'work', 'extract', 'not-exist');
            await gateway.ensureDirectory(targetDir);
            await gateway.writeTextFile(path.join(targetDir, 'old.onnx'), 'old');

            await expect(installer.replaceModelDirectoryForTest(missingSourceDir, targetDir)).rejects.toThrow();
            // 原目录内容完好，备份不残留
            expect(await gateway.readTextFile(path.join(targetDir, 'old.onnx'))).toBe('old');
            const remaining = [...gateway.directories].filter(dirPath => dirPath.includes('.backup-'));
            expect(remaining).toEqual([]);
        });
    });
});
