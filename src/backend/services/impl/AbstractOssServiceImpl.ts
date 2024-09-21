import { injectable } from 'inversify';
import { OssObject } from '@/common/types/OssObject';
import path from 'path';
import fs from 'fs';
import { OssService } from '@/backend/services/OssService';
import dpLog from '@/backend/ioc/logger';

@injectable()
export default abstract class AbstractOssServiceImpl<T> implements OssService<T> {

    private readonly METADATA_FILE = 'metadata.json';

    abstract getBasePath(): string;

    public async putFile( key: string, fileName: string, sourcePath: string) {
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

    public async delete( key: string) {
        const clipDir = path.join(this.getBasePath(), key);
        try {
            fs.rmSync(clipDir, { recursive: true, force: true });
        } catch (error) {
            dpLog.error(`Error deleting file`, error);
            throw error;
        }
    }

    public async get( key: string): Promise<OssObject & T> {
        const clipDir = path.join(this.getBasePath(), key);
        try {
            const metadataPath = path.join(clipDir, this.METADATA_FILE);
            const parse: T = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            return {
                ...parse,
                key,
                baseDir: clipDir,
            }
        } catch (error) {
            dpLog.error(`Error retrieving file`, error);
            throw error;
        }
    }

    public async updateMetadata( key: string, newMetadata: Partial<T>): Promise<void> {
        const clipDir = path.join(this.getBasePath(), key);
        const metadataPath = path.join(clipDir, this.METADATA_FILE);
        try {
            if (!fs.existsSync(metadataPath)) {
                fs.writeFileSync(metadataPath, JSON.stringify(newMetadata, null, 2));
            }
            const existingMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            const updatedMetadata = { ...existingMetadata, ...newMetadata } as T;
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
