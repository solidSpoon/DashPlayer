import fs from "fs";
import path from "path";

export type MetaData = {
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

class FileService {

    private basePath: string;

    constructor(basePath: string) {
        this.basePath = basePath;
    }


    async put(key: string, clipPath: string, metadata: MetaData) {
        const clipDir = path.join(this.basePath, key);

        try {
            await fs.mkdir(clipDir, { recursive: true });
            await fs.copyFile(clipPath, path.join(clipDir, 'clip.mp4'));
            const metadataPath = path.join(clipDir, 'metadata.json');
            await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
        } catch (error) {
            console.error("Error adding video clip:", error);
            throw error;
        }
    }

    async delete(key: string) {
        const clipDir = path.join(this.basePath, key);
        try {
            await fs.rm(clipDir, { recursive: true, force: true });
        } catch (error) {
            console.error("Error deleting video clip:", error);
            throw error;
        }
    }

    async get(key: string) {
        const clipDir = path.join(this.basePath, key);
        try {
            const metadataPath = path.join(clipDir, 'metadata.json');
            const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
            const clipPath = path.join(clipDir, 'clip.mp4');
            return { metadata, clipPath };
        } catch (error) {
            console.error("Error retrieving video clip:", error);
            throw error;
        }
    }

    async search(searchStr: string) {
        const results = [];
        const keys = await fs.readdir(this.basePath);

        for (const key of keys) {
            const metadataPath = path.join(this.basePath, key, 'metadata.json');
            const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
            if (metadata.video_name.includes(searchStr) || metadata.srt_str.includes(searchStr)) {
                const clipPath = path.join(this.basePath, key, 'clip.mp4');
                results.push({ key, metadata, clipPath });
            }
        }

        return results;
    }
}
