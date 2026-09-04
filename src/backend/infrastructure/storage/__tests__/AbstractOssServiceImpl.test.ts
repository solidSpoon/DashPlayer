import { beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'path';
import FileSystemGateway from '@/backend/services/gateways/storage/FileSystemGateway';
import AbstractOssServiceImpl from '@/backend/infrastructure/storage/AbstractOssServiceImpl';
import { OssBaseMeta } from '@/common/types/clipMeta';

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
 * 基于内存 Map 的文件系统网关实现，仅覆盖抽象存储类用到的行为语义。
 */
class MemoryFileSystemGateway implements FileSystemGateway {
    /** 文件路径到文本内容的映射。 */
    public readonly files = new Map<string, string>();
    /** 已存在的目录集合。 */
    public readonly directories = new Set<string>();

    private normalize(targetPath: string): string {
        return path.normalize(targetPath);
    }

    private missingPathError(targetPath: string): NodeJS.ErrnoException {
        const error = new Error(`ENOENT: no such file or directory, ${targetPath}`) as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        return error;
    }

    public async ensureDirectory(directoryPath: string): Promise<void> {
        const dirPath = this.normalize(directoryPath);
        this.directories.add(dirPath);
        let parentPath = path.dirname(dirPath);
        while (parentPath && parentPath !== dirPath && !this.directories.has(parentPath)) {
            this.directories.add(parentPath);
            parentPath = path.dirname(parentPath);
        }
    }

    public async fileExists(filePath: string): Promise<boolean> {
        return this.files.has(this.normalize(filePath));
    }

    public async directoryExists(directoryPath: string): Promise<boolean> {
        return this.directories.has(this.normalize(directoryPath));
    }

    public async getFileSize(filePath: string): Promise<number> {
        const content = this.files.get(this.normalize(filePath));
        if (content === undefined) {
            throw this.missingPathError(filePath);
        }
        return content.length;
    }

    public async readTextFile(filePath: string): Promise<string> {
        const content = this.files.get(this.normalize(filePath));
        if (content === undefined) {
            throw this.missingPathError(filePath);
        }
        return content;
    }

    public async getDirectorySize(directoryPath: string): Promise<number> {
        const dirPath = this.normalize(directoryPath);
        let totalSize = 0;
        for (const [filePath, content] of this.files) {
            if (filePath.startsWith(dirPath + path.sep)) {
                totalSize += content.length;
            }
        }
        return totalSize;
    }

    public async copyFile(sourcePath: string, targetPath: string): Promise<void> {
        const content = this.files.get(this.normalize(sourcePath));
        if (content === undefined) {
            throw this.missingPathError(sourcePath);
        }
        this.files.set(this.normalize(targetPath), content);
    }

    public async writeTextFile(filePath: string, content: string): Promise<void> {
        this.files.set(this.normalize(filePath), content);
    }

    public async moveFile(sourcePath: string, targetPath: string): Promise<void> {
        const normalizedSource = this.normalize(sourcePath);
        const content = this.files.get(normalizedSource);
        if (content === undefined) {
            throw this.missingPathError(sourcePath);
        }
        this.files.delete(normalizedSource);
        this.files.set(this.normalize(targetPath), content);
    }

    public async removeFileIfExists(filePath: string): Promise<void> {
        this.files.delete(this.normalize(filePath));
    }

    public async removeDirectoryIfExists(directoryPath: string): Promise<void> {
        const dirPath = this.normalize(directoryPath);
        this.directories.delete(dirPath);
        for (const filePath of [...this.files.keys()]) {
            if (filePath === dirPath || filePath.startsWith(dirPath + path.sep)) {
                this.files.delete(filePath);
            }
        }
        for (const childPath of [...this.directories]) {
            if (childPath === dirPath || childPath.startsWith(dirPath + path.sep)) {
                this.directories.delete(childPath);
            }
        }
    }

    public async listFileNames(directoryPath: string): Promise<string[]> {
        const dirPath = this.normalize(directoryPath);
        return [...this.files.keys()]
            .filter(filePath => path.dirname(filePath) === dirPath)
            .map(filePath => path.basename(filePath));
    }

    public async listDirectoryNames(directoryPath: string): Promise<string[]> {
        const dirPath = this.normalize(directoryPath);
        return [...this.directories]
            .filter(childPath => childPath !== dirPath && path.dirname(childPath) === dirPath)
            .map(childPath => path.basename(childPath));
    }

    public async removeEmptySubdirectories(directoryPath: string): Promise<void> {
        const dirPath = this.normalize(directoryPath);
        const children = [...this.directories].filter(
            childPath => childPath !== dirPath && path.dirname(childPath) === dirPath
        );
        for (const childPath of children) {
            await this.removeEmptySubdirectories(childPath);
        }
        const hasContent = [...this.files.keys()].some(
            filePath => path.dirname(filePath) === dirPath
        ) || this.directories.has(dirPath) === false;
        if (!hasContent && this.directories.has(dirPath)) {
            this.directories.delete(dirPath);
        }
    }

    public async pathIsMissing(targetPath: string): Promise<boolean> {
        const normalizedPath = this.normalize(targetPath);
        return !this.files.has(normalizedPath) && !this.directories.has(normalizedPath);
    }
}

/** 测试用片段元数据。 */
interface TestClipMeta {
    label: string;
}

/**
 * 抽象存储类的最小具体实现，用于验证通用 CRUD 行为。
 */
class TestOssServiceImpl extends AbstractOssServiceImpl<TestClipMeta> {
    constructor(fileSystemGateway: FileSystemGateway, private readonly basePath: string) {
        super(fileSystemGateway);
    }

    async getBasePath(): Promise<string> {
        return this.basePath;
    }

    getVersion(): number {
        return 1;
    }

    verifyNewMetadata(metadata: unknown): boolean {
        if (typeof metadata !== 'object' || metadata === null) {
            return false;
        }
        const record = metadata as Record<string, unknown>;
        return record.version === 1 && typeof record.label === 'string';
    }

    parseMetadata(metadata: unknown): OssBaseMeta & TestClipMeta | null {
        return this.verifyNewMetadata(metadata) ? metadata as OssBaseMeta & TestClipMeta : null;
    }
}

describe('片段本地存储抽象类', () => {
    const basePath = path.join('/', 'storage', 'clips');
    let gateway: MemoryFileSystemGateway;
    let storage: TestOssServiceImpl;

    beforeEach(() => {
        gateway = new MemoryFileSystemGateway();
        storage = new TestOssServiceImpl(gateway, basePath);
    });

    describe('写入片段文件', () => {
        it('把源文件复制进片段目录', async () => {
            await gateway.writeTextFile(path.join('/', 'tmp', 'source.mp4'), 'video-bytes');

            await storage.putFile('k1', 'clip.mp4', path.join('/', 'tmp', 'source.mp4'));

            const clipDir = path.join(basePath, 'k1');
            expect(await gateway.directoryExists(clipDir)).toBe(true);
            expect(await gateway.readTextFile(path.join(clipDir, 'clip.mp4'))).toBe('video-bytes');
        });

        it('源文件不存在时报错', async () => {
            await expect(
                storage.putFile('k1', 'clip.mp4', path.join('/', 'tmp', 'missing.mp4'))
            ).rejects.toThrow();
        });
    });

    describe('删除片段', () => {
        it('删除整个片段目录', async () => {
            await gateway.writeTextFile(path.join('/', 'tmp', 'source.mp4'), 'video-bytes');
            await storage.putFile('k1', 'clip.mp4', path.join('/', 'tmp', 'source.mp4'));

            await storage.delete('k1');

            expect(await gateway.pathIsMissing(path.join(basePath, 'k1'))).toBe(true);
        });

        it('删除不存在的片段不报错', async () => {
            await expect(storage.delete('not-exist')).resolves.toBeUndefined();
        });
    });

    describe('读取元数据', () => {
        it('片段不存在时返回空', async () => {
            expect(await storage.get('not-exist')).toBeNull();
        });

        it('写入元数据后能读回完整内容', async () => {
            await storage.updateMetadata('k1', { label: 'hello' });

            const meta = await storage.get('k1');
            expect(meta).toMatchObject({
                key: 'k1',
                baseDir: path.join(basePath, 'k1'),
                version: 1,
                label: 'hello',
            });
        });

        it('更新元数据时保留原有字段', async () => {
            await storage.updateMetadata('k1', { label: 'first' });
            await storage.updateMetadata('k1', {});

            const meta = await storage.get('k1');
            expect(meta?.label).toBe('first');
        });

        it('片段目录存在但元数据文件缺失时报错', async () => {
            await gateway.ensureDirectory(path.join(basePath, 'k1'));

            await expect(storage.get('k1')).rejects.toThrow('缺少元数据文件');
        });

        it('元数据内容损坏时报错，而不是当作片段不存在', async () => {
            const clipDir = path.join(basePath, 'k1');
            await gateway.ensureDirectory(clipDir);
            await gateway.writeTextFile(path.join(clipDir, 'metadata.json'), '{oops');

            await expect(storage.get('k1')).rejects.toThrow('不是合法 JSON');
        });

        it('元数据未通过版本校验时报错', async () => {
            const clipDir = path.join(basePath, 'k1');
            await gateway.ensureDirectory(clipDir);
            await gateway.writeTextFile(
                path.join(clipDir, 'metadata.json'),
                JSON.stringify({ version: 999, label: 'x' })
            );

            await expect(storage.get('k1')).rejects.toThrow('未通过版本校验');
        });
    });

    describe('更新元数据', () => {
        it('校验失败时不落盘也不留临时文件', async () => {
            await expect(
                storage.updateMetadata('k1', { label: 123 as unknown as string })
            ).rejects.toThrow('Invalid metadata');

            const clipDir = path.join(basePath, 'k1');
            expect(await gateway.pathIsMissing(path.join(clipDir, 'metadata.json'))).toBe(true);
            expect(await gateway.pathIsMissing(path.join(clipDir, 'metadata.json.tmp'))).toBe(true);
        });
    });

    describe('列出片段', () => {
        it('返回根目录下的全部片段目录', async () => {
            await gateway.writeTextFile(path.join('/', 'tmp', 'source.mp4'), 'video-bytes');
            await storage.putFile('k1', 'clip.mp4', path.join('/', 'tmp', 'source.mp4'));
            await storage.putFile('k2', 'clip.mp4', path.join('/', 'tmp', 'source.mp4'));

            expect(await storage.list()).toEqual(['k1', 'k2']);
        });

        it('根目录不存在时返回空列表', async () => {
            expect(await storage.list()).toEqual([]);
        });
    });
});
