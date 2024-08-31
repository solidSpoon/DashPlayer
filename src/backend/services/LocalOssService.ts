import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { MetaData, OssObject } from '@/common/types/OssObject';
import Util from '@/common/utils/Util';
import FfmpegService from '@/backend/services/FfmpegService';

class LocalOssService {

    private static getBasePath() {
        return path.join(app.getPath('downloads'), 'favorite_clips');
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
            return {key, ...metadata, clipPath, thumbnailPath: ''};
        } catch (error) {
            console.error("Error retrieving video clip:", error);
            throw error;
        }
    }

    public static async search(searchStr: string) : Promise<OssObject[]> {
        const results = [];
        const keys = fs.readdirSync(this.getBasePath()).filter(key => !key.startsWith('.'));
        for (const key of keys) {
            const metadataPath = path.join(this.getBasePath(), key, 'metadata.json');
            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            if (Util.strBlank(searchStr) || metadata.video_name.includes(searchStr) || metadata.srt_str.includes(searchStr)) {
                const clipPath = path.join(this.getBasePath(), key, 'clip.mp4');
                results.push({ key, ...metadata, clipPath , thumbnailPath: ''});
            }
        }
        return results;
    }
}

export default LocalOssService;
