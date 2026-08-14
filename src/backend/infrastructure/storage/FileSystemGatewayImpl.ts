import fs from 'fs/promises';
import { injectable } from 'inversify';
import FileSystemGateway from '@/backend/application/ports/gateways/storage/FileSystemGateway';

/**
 * 基于 Node.js 文件系统 API 的文件访问实现。
 */
@injectable()
export default class FileSystemGatewayImpl implements FileSystemGateway {
    /**
     * 确保目录存在。
     * @param directoryPath 目录绝对路径。
     */
    public async ensureDirectory(directoryPath: string): Promise<void> {
        await fs.mkdir(directoryPath, { recursive: true });
    }

    /**
     * 判断普通文件是否存在。
     * @param filePath 待检查的文件绝对路径。
     * @returns 普通文件存在时返回 `true`。
     */
    public async fileExists(filePath: string): Promise<boolean> {
        try {
            const stat = await fs.stat(filePath);
            if (!stat.isFile()) {
                throw new Error(`目标路径不是文件：${filePath}`);
            }
            return true;
        } catch (error) {
            if (this.readErrorCode(error) === 'ENOENT') {
                return false;
            }
            throw error;
        }
    }

    /**
     * 获取文件大小。
     * @param filePath 文件绝对路径。
     * @returns 文件大小，单位为字节。
     */
    public async getFileSize(filePath: string): Promise<number> {
        const stat = await fs.stat(filePath);
        if (!stat.isFile()) {
            throw new Error(`目标路径不是文件：${filePath}`);
        }
        return stat.size;
    }

    /**
     * 读取 UTF-8 文本文件。
     * @param filePath 文件绝对路径。
     * @returns 文件文本内容。
     */
    public async readTextFile(filePath: string): Promise<string> {
        return fs.readFile(filePath, 'utf8');
    }

    /**
     * 写入 UTF-8 文本文件。
     * @param filePath 文件绝对路径。
     * @param content 待写入的文本内容。
     */
    public async writeTextFile(filePath: string, content: string): Promise<void> {
        await fs.writeFile(filePath, content, 'utf8');
    }

    /**
     * 移动或重命名文件。
     * @param sourcePath 原文件绝对路径。
     * @param targetPath 目标文件绝对路径。
     */
    public async moveFile(sourcePath: string, targetPath: string): Promise<void> {
        await fs.rename(sourcePath, targetPath);
    }

    /**
     * 删除文件；文件不存在时不报错。
     * @param filePath 待删除的文件绝对路径。
     */
    public async removeFileIfExists(filePath: string): Promise<void> {
        try {
            await fs.unlink(filePath);
        } catch (error) {
            if (this.readErrorCode(error) !== 'ENOENT') {
                throw error;
            }
        }
    }

    /**
     * 列出目录中的普通文件名。
     * @param directoryPath 目录绝对路径。
     * @returns 目录下普通文件的名称，不包含目录路径。
     */
    public async listFileNames(directoryPath: string): Promise<string[]> {
        const entries = await fs.readdir(directoryPath, { withFileTypes: true });
        return entries
            .filter((entry) => entry.isFile())
            .map((entry) => entry.name);
    }

    /**
     * 从未知异常中读取 Node.js 错误码。
     * @param error 文件系统抛出的未知异常。
     * @returns Node.js 错误码；不存在时返回 `undefined`。
     */
    private readErrorCode(error: unknown): string | undefined {
        if (error instanceof Error && 'code' in error) {
            return (error as NodeJS.ErrnoException).code;
        }
        return undefined;
    }
}
