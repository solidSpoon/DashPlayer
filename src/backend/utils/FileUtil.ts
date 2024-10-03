import fs from 'fs';
import jschardet from 'jschardet';
import iconv from 'iconv-lite';
import { dialog } from 'electron';
import path from 'path';

export default class FileUtil {
    public static async read(path: string): Promise<string | null> {
        try {
            if (!fs.existsSync(path)) {
                return null;
            }
            const buffer = fs.readFileSync(path);
            const encoding = jschardet.detect(buffer).encoding;
            return iconv.decode(buffer, encoding).toString();
        } catch (e) {
            // show open dialog
            await dialog.showMessageBox({
                type: 'error',
                message: `无权限读取文件，请选择文件 ${path} 来授权`
            });

            const files = await dialog.showOpenDialog({
                properties: ['openFile']
            });
            if (files.canceled || files.filePaths.length === 0) {
                return null;
            }
            const buffer = fs.readFileSync(files.filePaths[0]);
            const encoding = jschardet.detect(buffer).encoding;
            return iconv.decode(buffer, encoding).toString();
        }
    }


    /**
     * 获取文件夹下的所有文件
     */
    public static async listFiles(path: string): Promise<string[]> {
        try {
            if (!fs.existsSync(path)) {
                return [];
            }
            return fs.readdirSync(path);
        } catch (e) {
            // show open dialog
            await dialog.showMessageBox({
                type: 'error',
                message: `无权限访问文件夹，请选择文件夹 ${path} 来授权`
            });

            const files = await dialog.showOpenDialog({
                properties: ['openDirectory']
            });
            if (files.canceled) {
                return [];
            }
            return fs.readdirSync(path);
        }
    }

    public static formatBytes = (bytes: number): string => {
        const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']; // 文件大小单位
        let size = bytes;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex += 1;
        }
        return `${size.toFixed(2)} ${units[unitIndex]}`;
    };
    /**
     * 查询缓存大小
     */
    public static calculateReadableFolderSize = async (folder: string): Promise<string> => {
        async function* walkDir(dir: string): AsyncGenerator<number> {
            const files = await fs.promises.readdir(dir, { withFileTypes: true });
            for (const file of files) {
                const filePath = path.join(dir, file.name);
                if (file.isDirectory()) {
                    yield* walkDir(filePath);
                } else if (file.isFile()) {
                    const stats = await fs.promises.stat(filePath);
                    yield stats.size;
                }
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
            console.error(`Error calculating folder size: ${error}`);
            return 'Error';
        }
    };
}
