import { promises as fsPromises } from 'fs';
import jschardet from 'jschardet';
import iconv from 'iconv-lite';
import path from 'path';
import { Nullable } from '@/common/types/Types';
import { VideoInfo } from '@/common/types/video-info';
import { getMainLogger } from '@/backend/infrastructure/logger';

export default class FileUtil {
    /**
     * 读取文件内容
     * @param filePath - 文件路径
     * @returns 文件内容或 null
     */
    public static async read(filePath: string): Promise<string | null> {
        await fsPromises.access(filePath);
        const buffer = await fsPromises.readFile(filePath);
        const detected = jschardet.detect(buffer);
        const encoding = detected.encoding || 'utf-8'; // 默认使用 utf-8
        return iconv.decode(buffer, encoding).toString();
    }

    /**
     * 格式化字节大小
     * @param bytes - 字节数
     * @returns 格式化后的字符串
     */
    public static formatBytes(bytes: number): string {
        const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        let size = bytes;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex += 1;
        }
        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }

    /**
     * 查询文件夹的总大小
     * @param folder - 文件夹路径
     * @returns 格式化后的总大小
     */
    public static async calculateReadableFolderSize(folder: string): Promise<string> {
        async function* walkDir(dir: string): AsyncGenerator<number> {
            try {
                const entries = await fsPromises.readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        yield* walkDir(fullPath);
                    } else if (entry.isFile()) {
                        try {
                            const stats = await fsPromises.stat(fullPath);
                            yield stats.size;
                        } catch (err) {
                            getMainLogger('FileUtil').error('get file size failed', { path: fullPath, error: err });
                        }
                    }
                }
            } catch (err) {
                getMainLogger('FileUtil').error('traverse directory failed', { dir, error: err });
                // 可以选择抛出错误或继续
            }
        }

        const getTotalSize = async (dir: string): Promise<number> => {
            let totalSize = 0;
            for await (const size of walkDir(dir)) {
                totalSize += size;
            }
            return totalSize;
        };

        try {
            const totalSize = await getTotalSize(folder);
            return FileUtil.formatBytes(totalSize);
        } catch (error) {
            getMainLogger('FileUtil').error('calculate folder size failed', { error });
            return '错误';
        }
    }

    /**
     * 比较两个视频信息是否相同
     * @returns true 如果视频未被修改，false 如果视频已被修改
     */
    public static compareVideoInfo(info1: Nullable<VideoInfo> , info2: Nullable<VideoInfo> ): boolean {
        if (!info1 || !info2) return false;
        // 基本信息比较
        const basicCheck =
            info1.filename === info2.filename &&
            info1.size === info2.size &&
            Math.abs(info1.duration - info2.duration) < 0.1; // 允许0.1秒的误差

        // 如果基本信息不同，直接返回false
        if (!basicCheck) return false;

        // 编码信息比较（如果都存在的话）
        if (info1.videoCodec && info2.videoCodec &&
            info1.videoCodec !== info2.videoCodec) {
            return false;
        }

        if (info1.audioCodec && info2.audioCodec &&
            info1.audioCodec !== info2.audioCodec) {
            return false;
        }

        // 比特率比较（如果都存在的话）
        if (info1.bitrate && info2.bitrate &&
            Math.abs(info1.bitrate - info2.bitrate) > 1000) { // 允许1kb/s的误差
            return false;
        }

        return true;
    }
}
