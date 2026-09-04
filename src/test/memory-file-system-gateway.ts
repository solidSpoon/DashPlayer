import path from 'path';
import FileSystemGateway from '@/backend/services/gateways/storage/FileSystemGateway';

/**
 * 基于内存 Map 的文件系统网关实现，供存储层测试替代真实磁盘 IO。
 *
 * 语义与 {@link FileSystemGateway} 的接口约定保持一致：
 * 缺失路径抛带 `ENOENT` 错误码的异常，删除类操作幂等。
 */
export class MemoryFileSystemGateway implements FileSystemGateway {
    /** 文件路径到文本内容的映射。 */
    public readonly files = new Map<string, string>();
    /** 已存在的目录集合。 */
    public readonly directories = new Set<string>();

    private normalize(targetPath: string): string {
        return path.normalize(targetPath);
    }

    private missingPathError(targetPath: string): NodeJS.ErrnoException {
        const error = new Error(`ENOENT: no such file or directory, ${targetPath}`) as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        return error;
    }

    /**
     * 确保目录存在。
     * @param directoryPath 目录绝对路径。
     */
    public async ensureDirectory(directoryPath: string): Promise<void> {
        const dirPath = this.normalize(directoryPath);
        this.directories.add(dirPath);
        let parentPath = path.dirname(dirPath);
        while (parentPath && parentPath !== dirPath && !this.directories.has(parentPath)) {
            this.directories.add(parentPath);
            parentPath = path.dirname(parentPath);
        }
    }

    /**
     * 判断普通文件是否存在。
     * @param filePath 待检查的文件绝对路径。
     * @returns 普通文件存在时返回 `true`。
     */
    public async fileExists(filePath: string): Promise<boolean> {
        return this.files.has(this.normalize(filePath));
    }

    /**
     * 判断目录是否存在。
     * @param directoryPath 待检查的目录绝对路径。
     * @returns 目录存在时返回 `true`。
     */
    public async directoryExists(directoryPath: string): Promise<boolean> {
        return this.directories.has(this.normalize(directoryPath));
    }

    /**
     * 获取普通文件大小。
     * @param filePath 文件绝对路径。
     * @returns 文件大小，单位为字节。
     */
    public async getFileSize(filePath: string): Promise<number> {
        const content = this.files.get(this.normalize(filePath));
        if (content === undefined) {
            throw this.missingPathError(filePath);
        }
        return content.length;
    }

    /**
     * 读取文本文件；内存实现直接返回写入的内容。
     * @param filePath 文件绝对路径。
     * @returns 文件文本内容。
     */
    public async readTextFile(filePath: string): Promise<string> {
        const content = this.files.get(this.normalize(filePath));
        if (content === undefined) {
            throw this.missingPathError(filePath);
        }
        return content;
    }

    /**
     * 读取文件的原始字节内容；内存实现返回文本内容的 UTF-8 字节。
     * @param filePath 文件绝对路径。
     * @returns 文件的二进制内容。
     */
    public async readBinaryFile(filePath: string): Promise<Buffer> {
        const content = this.files.get(this.normalize(filePath));
        if (content === undefined) {
            throw this.missingPathError(filePath);
        }
        return Buffer.from(content, 'utf-8');
    }

    /**
     * 计算目录内所有普通文件的总大小。
     * @param directoryPath 目录绝对路径。
     * @returns 文件总大小，单位为字节。
     */
    public async getDirectorySize(directoryPath: string): Promise<number> {
        const dirPath = this.normalize(directoryPath);
        let totalSize = 0;
        for (const [filePath, content] of this.files) {
            if (filePath.startsWith(dirPath + path.sep)) {
                totalSize += content.length;
            }
        }
        return totalSize;
    }

    /**
     * 复制普通文件。
     * @param sourcePath 源文件绝对路径。
     * @param targetPath 目标文件绝对路径。
     */
    public async copyFile(sourcePath: string, targetPath: string): Promise<void> {
        const content = this.files.get(this.normalize(sourcePath));
        if (content === undefined) {
            throw this.missingPathError(sourcePath);
        }
        this.files.set(this.normalize(targetPath), content);
    }

    /**
     * 写入 UTF-8 文本文件。
     * @param filePath 文件绝对路径。
     * @param content 待写入的文本内容。
     */
    public async writeTextFile(filePath: string, content: string): Promise<void> {
        this.files.set(this.normalize(filePath), content);
    }

    /**
     * 移动或重命名文件或目录；目录移动时连同其下全部内容一起迁移。
     * @param sourcePath 原文件或目录绝对路径。
     * @param targetPath 目标绝对路径。
     */
    public async moveFile(sourcePath: string, targetPath: string): Promise<void> {
        const normalizedSource = this.normalize(sourcePath);
        const normalizedTarget = this.normalize(targetPath);

        if (this.directories.has(normalizedSource)) {
            this.directories.delete(normalizedSource);
            this.directories.add(normalizedTarget);
            for (const filePath of [...this.files.keys()]) {
                if (filePath.startsWith(normalizedSource + path.sep)) {
                    const content = this.files.get(filePath)!;
                    this.files.delete(filePath);
                    this.files.set(normalizedTarget + filePath.slice(normalizedSource.length), content);
                }
            }
            for (const childPath of [...this.directories]) {
                if (childPath.startsWith(normalizedSource + path.sep)) {
                    this.directories.delete(childPath);
                    this.directories.add(normalizedTarget + childPath.slice(normalizedSource.length));
                }
            }
            return;
        }

        const content = this.files.get(normalizedSource);
        if (content === undefined) {
            throw this.missingPathError(sourcePath);
        }
        this.files.delete(normalizedSource);
        this.files.set(normalizedTarget, content);
    }

    /**
     * 删除文件；文件不存在时不报错。
     * @param filePath 待删除的文件绝对路径。
     */
    public async removeFileIfExists(filePath: string): Promise<void> {
        this.files.delete(this.normalize(filePath));
    }

    /**
     * 删除目录及其全部内容；目录不存在时不报错。
     * @param directoryPath 待删除的目录绝对路径。
     */
    public async removeDirectoryIfExists(directoryPath: string): Promise<void> {
        const dirPath = this.normalize(directoryPath);
        this.directories.delete(dirPath);
        for (const filePath of [...this.files.keys()]) {
            if (filePath === dirPath || filePath.startsWith(dirPath + path.sep)) {
                this.files.delete(filePath);
            }
        }
        for (const childPath of [...this.directories]) {
            if (childPath === dirPath || childPath.startsWith(dirPath + path.sep)) {
                this.directories.delete(childPath);
            }
        }
    }

    /**
     * 列出目录中的普通文件名。
     * @param directoryPath 目录绝对路径。
     * @returns 目录下普通文件的名称，不包含目录路径。
     */
    public async listFileNames(directoryPath: string): Promise<string[]> {
        const dirPath = this.normalize(directoryPath);
        return [...this.files.keys()]
            .filter(filePath => path.dirname(filePath) === dirPath)
            .map(filePath => path.basename(filePath));
    }

    /**
     * 列出目录中的子目录名。
     * @param directoryPath 目录绝对路径。
     * @returns 目录下子目录的名称，不包含目录路径。
     */
    public async listDirectoryNames(directoryPath: string): Promise<string[]> {
        const dirPath = this.normalize(directoryPath);
        return [...this.directories]
            .filter(childPath => childPath !== dirPath && path.dirname(childPath) === dirPath)
            .map(childPath => path.basename(childPath));
    }

    /**
     * 删除目录下已经为空的子目录。
     * @param directoryPath 待清理的根目录。
     */
    public async removeEmptySubdirectories(directoryPath: string): Promise<void> {
        const dirPath = this.normalize(directoryPath);
        const children = [...this.directories].filter(
            childPath => childPath !== dirPath && path.dirname(childPath) === dirPath
        );
        for (const childPath of children) {
            await this.removeEmptySubdirectories(childPath);
        }
        const hasFiles = [...this.files.keys()].some(
            filePath => path.dirname(filePath) === dirPath
        );
        if (!hasFiles && this.directories.has(dirPath) && children.length === 0) {
            this.directories.delete(dirPath);
        }
    }

    /**
     * 判断路径是否明确不存在。
     * @param targetPath 待检查的路径。
     * @returns 路径明确不存在时返回 `true`。
     */
    public async pathIsMissing(targetPath: string): Promise<boolean> {
        const normalizedPath = this.normalize(targetPath);
        return !this.files.has(normalizedPath) && !this.directories.has(normalizedPath);
    }
}
