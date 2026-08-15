import fs from 'fs/promises';
import path from 'path';
import jschardet from 'jschardet';
import iconv from 'iconv-lite';
import { injectable } from 'inversify';
import FileSystemGateway from '@/backend/services/gateways/storage/FileSystemGateway';

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
            if (this.isMissingPathError(error)) {
                return false;
            }
            throw error;
        }
    }

    /**
     * 判断目录是否存在。
     * @param directoryPath 待检查的目录绝对路径。
     * @returns 目录存在时返回 `true`。
     */
    public async directoryExists(directoryPath: string): Promise<boolean> {
        try {
            const stat = await fs.stat(directoryPath);
            return stat.isDirectory();
        } catch (error) {
            if (this.isMissingPathError(error)) {
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
     * 读取文本文件，并根据文件内容识别常见字符编码。
     * @param filePath 文件绝对路径。
     * @returns 解码后的文件文本。
     */
    public async readTextFile(filePath: string): Promise<string> {
        const buffer = await fs.readFile(filePath);
        const detected = jschardet.detect(buffer);
        const encoding = detected.encoding || 'utf-8';
        return iconv.decode(buffer, encoding);
    }

    /**
     * 计算目录内所有普通文件的总大小。
     * @param directoryPath 目录绝对路径。
     * @returns 文件总大小，单位为字节。
     */
    public async getDirectorySize(directoryPath: string): Promise<number> {
        const entries = await fs.readdir(directoryPath, { withFileTypes: true });
        let totalSize = 0;
        for (const entry of entries) {
            const entryPath = path.join(directoryPath, entry.name);
            if (entry.isDirectory()) {
                totalSize += await this.getDirectorySize(entryPath);
                continue;
            }
            if (entry.isFile()) {
                const stat = await fs.stat(entryPath);
                totalSize += stat.size;
            }
        }
        return totalSize;
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
            if (!this.isMissingPathError(error)) {
                throw error;
            }
        }
    }

    /**
     * 删除目录及其全部内容；目录不存在时不报错。
     * @param directoryPath 待删除的目录绝对路径。
     */
    public async removeDirectoryIfExists(directoryPath: string): Promise<void> {
        await fs.rm(directoryPath, { recursive: true, force: true });
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
     * 列出目录中的子目录名。
     * @param directoryPath 目录绝对路径。
     * @returns 目录下子目录的名称，不包含目录路径。
     */
    public async listDirectoryNames(directoryPath: string): Promise<string[]> {
        const entries = await fs.readdir(directoryPath, { withFileTypes: true });
        return entries
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name);
    }

    /**
     * 删除目录下已经为空的子目录。
     *
     * @param directoryPath 待清理的根目录。
     */
    public async removeEmptySubdirectories(directoryPath: string): Promise<void> {
        const directoryNames = await this.listDirectoryNames(directoryPath);
        for (const directoryName of directoryNames) {
            const childPath = path.join(directoryPath, directoryName);
            await this.removeEmptySubdirectories(childPath);
            const childEntries = await fs.readdir(childPath);
            if (childEntries.length === 0) {
                await fs.rmdir(childPath);
            }
        }
    }

    /**
     * 判断路径是否明确不存在。
     * @param targetPath 待检查的路径。
     * @returns 路径明确不存在时返回 `true`。
     */
    public async pathIsMissing(targetPath: string): Promise<boolean> {
        try {
            await fs.stat(targetPath);
            return false;
        } catch (error) {
            if (this.isMissingPathError(error)) {
                return true;
            }
            throw error;
        }
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

    /**
     * 判断文件系统错误是否表示路径不存在。
     * @param error 文件系统抛出的未知异常。
     * @returns 仅在路径不存在或上级路径不是目录时返回 `true`。
     */
    private isMissingPathError(error: unknown): boolean {
        const code = this.readErrorCode(error);
        return code === 'ENOENT' || code === 'ENOTDIR';
    }
}
