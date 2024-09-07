import fs from 'fs';
import path from 'path';
import { MetaData, OssObject } from '@/common/types/OssObject';
import FfmpegService from '@/backend/services/FfmpegService';
import LocationService, { LocationType } from '@/backend/services/LocationService';

class LocalOssService {

    private static getBasePath() {
        return LocationService.getStoragePath(LocationType.FAVORITE_CLIPS);
    }

    public static async put(key: string, sourcePath: string, metadata: MetaData) {
        const clipDir = path.join(this.getBasePath(), key);

        try {
            fs.mkdirSync(clipDir, { recursive: true });
            const clipPath = path.join(clipDir, 'clip.mp4');
            fs.copyFileSync(sourcePath, clipPath);
            // 生成缩略图
            const thumbnailPath = path.join(clipDir, 'thumbnail.jpg');
            await FfmpegService.thumbnail({
                inputFile: sourcePath,
                outputFileName: 'thumbnail.jpg',
                outputFolder: clipDir,
                time: 10 // 可以设置为视频中的特定时间点
            });
            const metadataPath = path.join(clipDir, 'metadata.json');
            fs.writeFileSync(metadataPath, JSON.stringify({
                ...metadata,
                thumbnailPath,
                clipPath
            }, null, 2));
        } catch (error) {
            console.error("Error adding video clip:", error);
            throw error;
        }
    }

    public static async delete(key: string) {
        const clipDir = path.join(this.getBasePath(), key);
        try {
            fs.rmSync(clipDir, { recursive: true, force: true });
        } catch (error) {
            console.error("Error deleting video clip:", error);
            throw error;
        }
    }

    public static async get(key: string): Promise<OssObject> {
        const clipDir = path.join(this.getBasePath(), key);
        try {
            const metadataPath = path.join(clipDir, 'metadata.json');
            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            const clipPath = path.join(clipDir, 'clip.mp4');
            const thumbnailPath = path.join(clipDir, 'thumbnail.jpg');
            return {key, ...metadata, clipPath, thumbnailPath: thumbnailPath};
        } catch (error) {
            console.error("Error retrieving video clip:", error);
            throw error;
        }
    }
}

export default LocalOssService;
