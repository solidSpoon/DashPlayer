import { beforeEach, describe, expect, it } from 'vitest';
import path from 'path';
import AccessRecoveringFileSystemGateway from '@/backend/infrastructure/storage/AccessRecoveringFileSystemGateway';
import StorageDirectoryProvider from '@/backend/services/gateways/storage/StorageDirectoryProvider';
import { MemoryFileSystemGateway } from '@/test/memory-file-system-gateway';

/**
 * 目录提供器的测试替身：记录权限确认的目标路径，并可按路径模拟恢复失败。
 *
 * 弹窗恢复属于系统边界，测试里不引入真实 Electron dialog。
 */
class RecordingStorageDirectoryProvider implements StorageDirectoryProvider {
    /** 每次权限确认收到的目标路径，按调用顺序记录。 */
    public readonly ensuredPaths: string[] = [];
    /** 配置为恢复失败的路径集合；命中时权限确认抛错。 */
    public readonly deniedPaths = new Set<string>();

    public async ensurePathAccessPermissionIfExists(targetPath: string): Promise<void> {
        this.ensuredPaths.push(targetPath);
        if (this.deniedPaths.has(targetPath)) {
            throw new Error(`当前文件夹暂时无法访问：${targetPath}`);
        }
    }

    public async provideDirectory(): Promise<string> {
        throw new Error('测试替身不提供目录解析');
    }

    public async getRootStatus(): Promise<never> {
        throw new Error('测试替身不提供目录状态');
    }
}

describe('带访问权限自动恢复的文件系统网关', () => {
    let memoryGateway: MemoryFileSystemGateway;
    let provider: RecordingStorageDirectoryProvider;
    let gateway: AccessRecoveringFileSystemGateway;

    beforeEach(() => {
        memoryGateway = new MemoryFileSystemGateway();
        provider = new RecordingStorageDirectoryProvider();
        gateway = new AccessRecoveringFileSystemGateway(memoryGateway, provider);
    });

    it('权限确认通过时，写入和读取正常工作', async () => {
        const filePath = path.join('/', 'media', 'a.srt');

        await gateway.writeTextFile(filePath, 'hello');
        expect(await gateway.readTextFile(filePath)).toBe('hello');
        // 写入与读取各确认一次目标路径
        expect(provider.ensuredPaths).toEqual([filePath, filePath]);
    });

    it('权限恢复失败时，操作失败且不会触达底层文件系统', async () => {
        const filePath = path.join('/', 'media', 'a.srt');
        provider.deniedPaths.add(filePath);

        await expect(gateway.writeTextFile(filePath, 'hello')).rejects.toThrow('暂时无法访问');
        // 底层内存网关中不应当出现该文件
        expect(await memoryGateway.pathIsMissing(filePath)).toBe(true);
    });

    it('复制文件时对源和目标路径都做权限确认', async () => {
        const sourcePath = path.join('/', 'media', 'a.mp4');
        const targetPath = path.join('/', 'clips', 'a.mp4');
        await memoryGateway.writeTextFile(sourcePath, 'video');

        await gateway.copyFile(sourcePath, targetPath);

        expect(provider.ensuredPaths).toEqual([sourcePath, targetPath]);
        expect(await memoryGateway.readTextFile(targetPath)).toBe('video');
    });

    it('复制时目标路径权限恢复失败，源文件保持原样且不产生目标文件', async () => {
        const sourcePath = path.join('/', 'media', 'a.mp4');
        const targetPath = path.join('/', 'clips', 'a.mp4');
        provider.deniedPaths.add(targetPath);
        await memoryGateway.writeTextFile(sourcePath, 'video');

        await expect(gateway.copyFile(sourcePath, targetPath)).rejects.toThrow('暂时无法访问');
        expect(await memoryGateway.readTextFile(sourcePath)).toBe('video');
        expect(await memoryGateway.pathIsMissing(targetPath)).toBe(true);
    });

    it('列目录前对目录做权限确认', async () => {
        const dirPath = path.join('/', 'media', 'season-1');
        await memoryGateway.ensureDirectory(dirPath);

        expect(await gateway.listDirectoryNames(path.join('/', 'media'))).toEqual(['season-1']);
        expect(provider.ensuredPaths).toEqual([path.join('/', 'media')]);
    });

    it('路径不存在时权限确认是空操作，操作语义由底层网关决定', async () => {
        const missingPath = path.join('/', 'media', 'not-exist.srt');

        // 不存在路径的读取仍按底层语义抛缺失错误，而不是权限错误
        await expect(gateway.readTextFile(missingPath)).rejects.toThrow('ENOENT');
    });
});
