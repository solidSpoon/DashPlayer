import fs from 'fs';
import path from 'path';
import { MetaData, OssObject } from '@/common/types/OssObject';
import FfmpegService from '@/backend/services/FfmpegService';
import LocationService, { LocationType } from '@/backend/services/LocationService';
import { injectable } from 'inversify';

export interface OssService<T, R> {
    put(key: string, sourcePath: string, metadata: T): Promise<void>;

    delete(key: string): Promise<void>;

    get(key: string): Promise<R>;
}
@injectable()
class LocalOssService implements OssService<MetaData, OssObject> {

    private getBasePath() {
        return LocationService.getStoragePath(LocationType.FAVORITE_CLIPS);
    }

    public async put(key: string, sourcePath: string, metadata: MetaData) {
        const clipDir = path.join(this.getBasePath(), key);

        try {
            fs.mkdirSync(clipDir, { recursive: true });
            const clipPath = path.join(clipDir, 'clip.mp4');
            fs.copyFileSync(sourcePath, clipPath);
            // 生成缩略图
            const thumbnailPath = path.join(clipDir, 'thumbnail.jpg');
            const length = await FfmpegService.duration(sourcePath);
            await FfmpegService.thumbnail({
                inputFile: sourcePath,
                outputFileName: 'thumbnail.jpg',
                outputFolder: clipDir,
                time: length / 2
            });
            const metadataPath = path.join(clipDir, 'metadata.json');
            fs.writeFileSync(metadataPath, JSON.stringify({
                ...metadata,
                thumbnailPath,
                clipPath
            }, null, 2));
        } catch (error) {
            console.error('Error adding video clip:', error);
            throw error;
        }
    }

    public async delete(key: string) {
        const clipDir = path.join(this.getBasePath(), key);
        try {
            fs.rmSync(clipDir, { recursive: true, force: true });
        } catch (error) {
            console.error('Error deleting video clip:', error);
            throw error;
        }
    }

    public async get(key: string): Promise<OssObject> {
        const clipDir = path.join(this.getBasePath(), key);
        try {
            const metadataPath = path.join(clipDir, 'metadata.json');
            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            const clipPath = path.join(clipDir, 'clip.mp4');
            const thumbnailPath = path.join(clipDir, 'thumbnail.jpg');
            return { key, ...metadata, clipPath, thumbnailPath: thumbnailPath };
        } catch (error) {
            console.error('Error retrieving video clip:', error);
            throw error;
        }
    }
}

export default LocalOssService;