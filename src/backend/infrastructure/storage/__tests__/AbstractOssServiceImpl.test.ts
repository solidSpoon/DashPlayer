import { beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'path';
import FileSystemGateway from '@/backend/services/gateways/storage/FileSystemGateway';
import AbstractOssServiceImpl from '@/backend/infrastructure/storage/AbstractOssServiceImpl';
import { OssBaseMeta } from '@/common/types/clipMeta';
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
