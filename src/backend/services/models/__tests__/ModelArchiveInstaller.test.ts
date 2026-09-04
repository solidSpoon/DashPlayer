import { beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'path';
import { ModelArchiveInstaller, ModelArchiveInstallerOptions } from '@/backend/services/models/ModelArchiveInstaller';
import RendererGateway from '@/backend/services/gateways/renderer/RendererGateway';
import StorageDirectoryProvider from '@/backend/services/gateways/storage/StorageDirectoryProvider';
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
 * 目录提供器测试替身：固定返回 models 根目录。
 */
class FixedStorageDirectoryProvider implements StorageDirectoryProvider {
    public async provideDirectory(): Promise<string> {
        return path.join('/', 'models');
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
    downloadUrl: 'https://example.com/model.tar.bz2',
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
