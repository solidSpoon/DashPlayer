import { injectable } from 'inversify';
import path from 'path';
import fs from 'fs';
import { OssService } from '@/backend/services/OssService';
import dpLog from '@/backend/ioc/logger';
import { OssBaseMeta } from '@/common/types/clipMeta';

@injectable()
export default abstract class AbstractOssServiceImpl<T> implements OssService<T> {

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
    abstract verifyNewMetadata(metadata: any): boolean;

    /**
     * 解析元数据为最新版本
     * @param metadata
     * @returns null if metadata is invalid
     */
    abstract parseMetadata(metadata: any): OssBaseMeta & T | null;

    public async putFile(key: string, fileName: string, sourcePath: string) {
        const clipDir = path.join(this.getBasePath(), key);
        try {
            fs.mkdirSync(clipDir, { recursive: true });
            const destPath = path.join(clipDir, fileName);
            fs.copyFileSync(sourcePath, destPath);
        } catch (error) {
            dpLog.error(`Error adding file ${fileName}`, error);
            throw error;
        }
    }

    public async delete(key: string) {
        const clipDir = path.join(this.getBasePath(), key);
        try {
            fs.rmSync(clipDir, { recursive: true, force: true });
        } catch (error) {
            dpLog.error(`Error deleting file`, error);
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
            dpLog.error(`Error retrieving file`, error);
            return null;
        }
    }

    public async updateMetadata(key: string, newMetadata: Partial<T>): Promise<void> {
        const clipDir = path.join(this.getBasePath(), key);
        const metadataPath = path.join(clipDir, this.METADATA_FILE);
        try {
            if (!fs.existsSync(metadataPath)) {
                fs.writeFileSync(metadataPath, JSON.stringify(newMetadata, null, 2));
            }
            const existingMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
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
            fs.writeFileSync(metadataPath, JSON.stringify(updatedMetadata, null, 2));
        } catch (error) {
            dpLog.error(`Error updating metadata `, error);
            throw error;
        }
    }

    public async list(): Promise<string[]> {
        const basePath = this.getBasePath();
        try {
            const items = fs.readdirSync(basePath, { withFileTypes: true });
            return items
                .filter(item => item.isDirectory())
                .map(item => item.name);
        } catch (error) {
            dpLog.error(`Error listing objects`, error);
            throw error;
        }
    }
}
