import { promises as fsPromises } from 'fs';
import jschardet from 'jschardet';
import iconv from 'iconv-lite';
import { dialog } from 'electron';
import path from 'path';
import OpenDialogOptions = Electron.OpenDialogOptions;

/**
 * 装饰器工厂，用于处理路径访问权限错误
 */
function handlePathAccessError(): MethodDecorator {
    return function(
        target: object,
        propertyKey: string | symbol,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;

        descriptor.value = async function(...args: any[]) {
            const originalPath: string = args[0];
            try {
                return await originalMethod.apply(this, args);
            } catch (error: any) {
                if (isPermissionError(error)) {
                    const dirPath = path.dirname(originalPath);
                    const defaultMessage = `无权限访问路径 "${dirPath}"，请选择该文件夹以授权。`;

                    // 显示错误消息
                    await dialog.showMessageBox({
                        type: 'error',
                        message: defaultMessage
                    });

                    // 显示选择文件夹对话框
                    const openDialogOptions: OpenDialogOptions = { properties: ['openDirectory'] };

                    const result = await dialog.showOpenDialog(openDialogOptions);
                    if (result.canceled || result.filePaths.length === 0) {
                        return null;
                    }

                    try {
                        return await originalMethod.apply(this, args);
                    } catch (err) {
                        console.error(`重新尝试访问路径失败: ${err}`);
                        return null;
                    }
                } else {
                    // 其他类型错误继续抛出
                    throw error;
                }
            }
        };

        return descriptor;
    };
}

/**
 * 判断错误是否为权限错误
 * @param error - 捕获到的错误
 * @returns 是否为权限错误
 */
function isPermissionError(error: any): boolean {
    // Electron 和 Node.js 中权限错误的编码可能不同
    // 可以根据 error.code 进行判断
    return (
        error.code === 'EACCES' ||
        error.code === 'EPERM' ||
        (error.message && error.message.toLowerCase().includes('permission'))
    );
}

export default class FileUtil {
    /**
     * 读取文件内容
     * @param filePath - 文件路径
     * @returns 文件内容或 null
     */
    @handlePathAccessError()
    public static async read(filePath: string): Promise<string | null> {
        await fsPromises.access(filePath);
        const buffer = await fsPromises.readFile(filePath);
        const detected = jschardet.detect(buffer);
        const encoding = detected.encoding || 'utf-8'; // 默认使用 utf-8
        return iconv.decode(buffer, encoding).toString();
    }

    /**
     * 获取文件夹下的所有文件
     * @param dirPath - 文件夹路径
     * @returns 文件名数组
     */
    @handlePathAccessError()
    public static async listFiles(dirPath: string): Promise<string[]> {
        await fsPromises.access(dirPath);
        return await fsPromises.readdir(dirPath);
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
    @handlePathAccessError()
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
                            console.error(`获取文件大小失败: ${fullPath}`, err);
                        }
                    }
                }
            } catch (err) {
                console.error(`遍历目录失败: ${dir}`, err);
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
            console.error(`计算文件夹大小失败: ${error}`);
            return '错误';
        }
    }

    /**
     * 清理空目录
     * @param dir - 目标目录
     */
    @handlePathAccessError()
    public static async cleanEmptyDirectories(dir: string): Promise<void> {
        try {
            const entries = await fsPromises.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);

                if (entry.isDirectory()) {
                    // 递归清理子目录
                    await FileUtil.cleanEmptyDirectories(fullPath);

                    // 清理后检查目录是否为空
                    try {
                        const subEntries = await fsPromises.readdir(fullPath);
                        if (subEntries.length === 0) {
                            await fsPromises.rmdir(fullPath);
                            console.log(`已移除空目录: ${fullPath}`);
                        }
                    } catch (error) {
                        console.error(`移除目录失败 ${fullPath}:`, error);
                    }
                }
            }
        } catch (error) {
            console.error(`清理目录失败 ${dir}:`, error);
            throw error; // 重新抛出错误以便装饰器处理
        }
    }

    /**
     * 如果文见存在则删除
     */
    @handlePathAccessError()
    public static async deleteFile(filePath: string): Promise<void> {
        try {
            await fsPromises.access(filePath);
            await fsPromises.unlink(filePath);
        } catch (error) {
            console.error(`文件不存在: ${filePath}`);
            return;
        }
    }

    /**
     * 路径是否存在并且是文件
     */
    @handlePathAccessError()
    public static async isFile(filePath: string): Promise<boolean> {
        try {
            const stats = await fsPromises.stat(filePath);
            return stats.isFile();
        } catch (error) {
            console.error(`获取文件信息失败: ${filePath}`);
            return false;
        }
    }

    /**
     * 路径是否存在并且是文件夹
     */
    @handlePathAccessError()
    public static async isDirectory(dirPath: string): Promise<boolean> {
        try {
            const stats = await fsPromises.stat(dirPath);
            return stats.isDirectory();
        } catch (error) {
            console.error(`获取文件夹信息失败: ${dirPath}`);
            return false;
        }
    }

    /**
     * 路径是否存在
     */
    public static async exists(path: string): Promise<boolean> {
        try {
            await fsPromises.access(path);
            return true;
        } catch (error) {
            return false;
        }
    }
}
