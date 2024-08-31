import fs from "fs";
import path from "path";
import { app } from 'electron';

export type MetaData = {
    "key": string;
    /**
     * 视频名
     */
    "video_name": string;
    /**
     * 创建时间
     */
    "created_at": number;
    "start_time": number,
    "end_time": number,
    /**
     * 对应字幕文件的片段
     */
    "srt_clip": string;
    /**
     * 字幕文件中台词部分（不包括时间）
     */
    "srt_str": string;
}

class LocalOssService {

    private static getBasePath() {
        return path.join(app.getPath('downloads'), 'favorite_clips');
    }


    public static async put(key: string, clipPath: string, metadata: MetaData) {
        const clipDir = path.join(this.getBasePath(), key);

        try {
            fs.mkdirSync(clipDir, { recursive: true });
            fs.copyFileSync(clipPath, path.join(clipDir, 'clip.mp4'));
            const metadataPath = path.join(clipDir, 'metadata.json');
            fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
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

    public static async get(key: string) {
        const clipDir = path.join(this.getBasePath(), key);
        try {
            const metadataPath = path.join(clipDir, 'metadata.json');
            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            const clipPath = path.join(clipDir, 'clip.mp4');
            return { metadata, clipPath };
        } catch (error) {
            console.error("Error retrieving video clip:", error);
            throw error;
        }
    }

    public static async search(searchStr: string) {
        const results = [];
        const keys = fs.readdirSync(this.getBasePath());

        for (const key of keys) {
            const metadataPath = path.join(this.getBasePath(), key, 'metadata.json');
            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            if (metadata.video_name.includes(searchStr) || metadata.srt_str.includes(searchStr)) {
                const clipPath = path.join(this.getBasePath(), key, 'clip.mp4');
                results.push({ key, metadata, clipPath });
            }
        }

        return results;
    }
}

export default LocalOssService;
