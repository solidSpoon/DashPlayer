import { injectable } from 'inversify';
import path from 'path';
import fs from 'fs';
import { OssService } from '@/backend/application/services/OssService';
import { getMainLogger } from '@/backend/infrastructure/logger';
import { OssBaseMeta } from '@/common/types/clipMeta';

@injectable()
export default abstract class AbstractOssServiceImpl<T> implements OssService<T> {
    private readonly logger = getMainLogger('AbstractOssServiceImpl');

    private readonly METADATA_FILE = 'metadata.json';

    /**
     * 获取存储库的基本路径
     */
    abstract getBasePath(): string;

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
        const clipDir = path.join(this.getBasePath(), key);
        try {
            fs.mkdirSync(clipDir, { recursive: true });
            const destPath = path.join(clipDir, fileName);
            fs.copyFileSync(sourcePath, destPath);
        } catch (error) {
            this.logger.error(`Error adding file ${fileName}`, error);
            throw error;
        }
    }

    public async delete(key: string) {
        const clipDir = path.join(this.getBasePath(), key);
        try {
            fs.rmSync(clipDir, { recursive: true, force: true });
        } catch (error) {
            this.logger.error(`Error deleting file`, error);
            throw error;
        }
    }

    public async get(key: string): Promise<OssBaseMeta & T | null> {
        const clipDir = path.join(this.getBasePath(), key);
        try {
            const metadataPath = path.join(clipDir, this.METADATA_FILE);
            if (!fs.existsSync(metadataPath)) {
                return null;
            }
            const metaFileInfo: T & OssBaseMeta = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            const res = {
                ...metaFileInfo,
                key: key,
                baseDir: clipDir
            };
            return this.parseMetadata(res);
        } catch (error) {
            this.logger.error(`Error retrieving file`, error);
            return null;
        }
    }

    /**
     * 原子更新片段元数据。
     *
     * 行为说明：
     * - 先写入临时文件，再通过 rename 覆盖正式文件，尽量避免进程中断导致的半写入。
     * - 当原文件不存在时，会基于空对象构建完整元数据。
     *
     * @param key 片段 key。
     * @param newMetadata 需要合并的新元数据。
     */
    public async updateMetadata(key: string, newMetadata: Partial<T>): Promise<void> {
        const clipDir = path.join(this.getBasePath(), key);
        const metadataPath = path.join(clipDir, this.METADATA_FILE);
        const tempMetadataPath = `${metadataPath}.tmp`;
        try {
            fs.mkdirSync(clipDir, { recursive: true });
            const existingMetadata = fs.existsSync(metadataPath)
                ? JSON.parse(fs.readFileSync(metadataPath, 'utf8'))
                : {};
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
            fs.writeFileSync(tempMetadataPath, JSON.stringify(updatedMetadata, null, 2));
            fs.renameSync(tempMetadataPath, metadataPath);
        } catch (error) {
            try {
                if (fs.existsSync(tempMetadataPath)) {
                    fs.rmSync(tempMetadataPath, { force: true });
                }
            } catch {
                // 清理临时文件失败时不阻断主流程
            }
            this.logger.error(`Error updating metadata `, error);
            throw error;
        }
    }

    public async list(): Promise<string[]> {
        const basePath = this.getBasePath();
        if (!fs.existsSync(basePath)) {
            return [];
        }
        try {
            const items = fs.readdirSync(basePath, { withFileTypes: true });
            return items
                .filter(item => item.isDirectory())
                .map(item => item.name);
        } catch (error) {
            this.logger.error(`Error listing objects`, error);
            throw error;
        }
    }
}
