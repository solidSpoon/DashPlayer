import path from 'path';
import { injectable } from 'inversify';
import { OssService } from '@/backend/services/OssService';
import { getMainLogger } from '@/backend/infrastructure/logger';
import { OssBaseMeta } from '@/common/types/clipMeta';
import FileSystemGateway from '@/backend/services/gateways/storage/FileSystemGateway';

/**
 * 片段本地存储的通用实现；仅由具体子类继承，不直接在容器中注册。
 *
 * `@injectable` 不能省：inversify 解析子类时会沿原型链检查基类的装饰器元数据，
 * 缺失会在容器解析时抛「Missing required @injectable annotation」。
 */
@injectable()
export default abstract class AbstractOssServiceImpl<T> implements OssService<T> {
    private readonly logger = getMainLogger('AbstractOssServiceImpl');

    private readonly METADATA_FILE = 'metadata.json';

    /**
     * 文件系统访问入口；由具体子类通过构造函数传入。
     */
    protected readonly fileSystemGateway: FileSystemGateway;

    /**
     * 构造函数必须为 public：inversify 的 `@injectable` 要求构造器是 public 签名。
     */
    public constructor(fileSystemGateway: FileSystemGateway) {
        this.fileSystemGateway = fileSystemGateway;
    }

    /**
     * 获取存储库的基本路径
     */
    abstract getBasePath(): Promise<string>;

    /**
     * 获取当前元数据版本
     */
    abstract getVersion(): number;

    /**
     * 验证元数据是否符合最新版本
     */
    abstract verifyNewMetadata(metadata: unknown): boolean;

    /**
     * 解析元数据为最新版本
     * @param metadata
     * @returns null if metadata is invalid
     */
    abstract parseMetadata(metadata: unknown): OssBaseMeta & T | null;

    public async putFile(key: string, fileName: string, sourcePath: string) {
        const clipDir = path.join(await this.getBasePath(), key);
        try {
            await this.fileSystemGateway.ensureDirectory(clipDir);
            await this.fileSystemGateway.copyFile(sourcePath, path.join(clipDir, fileName));
        } catch (error) {
            this.logger.error('failed to add file', { fileName, error });
            throw error;
        }
    }

    public async delete(key: string) {
        const clipDir = path.join(await this.getBasePath(), key);
        try {
            await this.fileSystemGateway.removeDirectoryIfExists(clipDir);
        } catch (error) {
            this.logger.error('failed to delete file', { error });
            throw error;
        }
    }

    /**
     * 读取片段元数据。
     *
     * 行为说明：
     * - 片段目录不存在时返回 `null`，表示片段确实不存在；
     * - 目录存在但元数据缺失、损坏或未通过版本校验时直接抛错，
     *   避免把数据损坏伪装成“片段不存在”被上层静默过滤。
     *
     * @param key 片段 key。
     * @returns 校验通过的元数据；片段不存在时返回 `null`。
     */
    public async get(key: string): Promise<OssBaseMeta & T | null> {
        const clipDir = path.join(await this.getBasePath(), key);
        const metadataPath = path.join(clipDir, this.METADATA_FILE);

        if (await this.fileSystemGateway.pathIsMissing(clipDir)) {
            return null;
        }

        try {
            if (await this.fileSystemGateway.pathIsMissing(metadataPath)) {
                throw new Error(`片段目录缺少元数据文件：${metadataPath}`);
            }

            const metadataText = await this.fileSystemGateway.readTextFile(metadataPath);
            let rawMetadata: Record<string, unknown>;
            try {
                rawMetadata = JSON.parse(metadataText) as Record<string, unknown>;
            } catch (error) {
                throw new Error(`片段元数据不是合法 JSON：${metadataPath}`, { cause: error });
            }

            const parsed = this.parseMetadata({ ...rawMetadata, key: key, baseDir: clipDir });
            if (parsed === null) {
                throw new Error(`片段元数据未通过版本校验：${metadataPath}`);
            }
            return parsed;
        } catch (error) {
            this.logger.error('failed to retrieve file', { error });
            throw error;
        }
    }

    /**
     * 原子更新片段元数据。
     *
     * 行为说明：
     * - 先写入临时文件，再通过 rename 覆盖正式文件，尽量避免进程中断导致的半写入。
     * - 当原文件不存在时，会基于空对象构建完整元数据。
     * - 校验失败或写入失败时会清理临时文件，不留在片段目录里。
     *
     * @param key 片段 key。
     * @param newMetadata 需要合并的新元数据。
     */
    public async updateMetadata(key: string, newMetadata: Partial<T>): Promise<void> {
        const clipDir = path.join(await this.getBasePath(), key);
        const metadataPath = path.join(clipDir, this.METADATA_FILE);
        const tempMetadataPath = `${metadataPath}.tmp`;
        try {
            await this.fileSystemGateway.ensureDirectory(clipDir);
            const existingMetadata = await this.fileSystemGateway.pathIsMissing(metadataPath)
                ? {}
                : JSON.parse(await this.fileSystemGateway.readTextFile(metadataPath));
            const updatedMetadata = {
                ...existingMetadata,
                version: this.getVersion(),
                key: key,
                baseDir: clipDir,
                ...newMetadata
            } as T & OssBaseMeta;
            if (!this.verifyNewMetadata(updatedMetadata)) {
                throw new Error('Invalid metadata');
            }
            await this.fileSystemGateway.writeTextFile(tempMetadataPath, JSON.stringify(updatedMetadata, null, 2));
            await this.fileSystemGateway.moveFile(tempMetadataPath, metadataPath);
        } catch (error) {
            try {
                await this.fileSystemGateway.removeFileIfExists(tempMetadataPath);
            } catch {
                // 清理临时文件失败时不阻断主流程
            }
            this.logger.error('failed to update metadata', { error });
            throw error;
        }
    }

    public async list(): Promise<string[]> {
        const basePath = await this.getBasePath();
        if (!(await this.fileSystemGateway.directoryExists(basePath))) {
            return [];
        }
        try {
            return await this.fileSystemGateway.listDirectoryNames(basePath);
        } catch (error) {
            this.logger.error('failed to list objects', { error });
            throw error;
        }
    }
}
