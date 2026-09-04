import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import FileSystemGateway from '@/backend/services/gateways/storage/FileSystemGateway';
import StorageDirectoryProvider from '@/backend/services/gateways/storage/StorageDirectoryProvider';

/**
 * 带访问权限自动恢复的文件系统网关装饰器。
 *
 * 行为说明：
 * - 每个文件操作执行前，先通过 {@link StorageDirectoryProvider} 确认目标路径可访问；
 * - 路径不存在时不做任何处理，交由内层网关按各自语义处理（创建、报错或视为缺失）；
 * - 路径存在但不可访问时（典型场景是 macOS 收回了文件夹授权），由目录提供器
 *   引导用户重新选择文件夹完成恢复，恢复失败则当前操作直接失败；
 * - 业务代码不需要再在每次文件操作前手动调用权限确认。
 */
@injectable()
export default class AccessRecoveringFileSystemGateway implements FileSystemGateway {
    constructor(
        @inject(TYPES.RawFileSystemGateway) private readonly inner: FileSystemGateway,
        @inject(TYPES.StorageDirectoryProvider) private readonly storageDirectoryProvider: StorageDirectoryProvider,
    ) {}

    /**
     * 确保一组目标路径在操作前可访问。
     * @param paths 本次操作涉及的文件或目录绝对路径。
     */
    private async ensureAccessible(...paths: string[]): Promise<void> {
        for (const targetPath of paths) {
            await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(targetPath);
        }
    }

    /**
     * 确保目录存在。
     * @param directoryPath 目录绝对路径。
     */
    public async ensureDirectory(directoryPath: string): Promise<void> {
        await this.ensureAccessible(directoryPath);
        await this.inner.ensureDirectory(directoryPath);
    }

    /**
     * 判断普通文件是否存在。
     * @param filePath 待检查的文件绝对路径。
     * @returns 普通文件存在时返回 `true`。
     */
    public async fileExists(filePath: string): Promise<boolean> {
        await this.ensureAccessible(filePath);
        return this.inner.fileExists(filePath);
    }

    /**
     * 判断目录是否存在。
     * @param directoryPath 待检查的目录绝对路径。
     * @returns 目录存在时返回 `true`，目标不是目录时返回 `false`。
     */
    public async directoryExists(directoryPath: string): Promise<boolean> {
        await this.ensureAccessible(directoryPath);
        return this.inner.directoryExists(directoryPath);
    }

    /**
     * 获取普通文件大小。
     * @param filePath 文件绝对路径。
     * @returns 文件大小，单位为字节。
     */
    public async getFileSize(filePath: string): Promise<number> {
        await this.ensureAccessible(filePath);
        return this.inner.getFileSize(filePath);
    }

    /**
     * 读取文本文件，并自动识别常见字符编码。
     * @param filePath 文件绝对路径。
     * @returns 文件文本内容。
     */
    public async readTextFile(filePath: string): Promise<string> {
        await this.ensureAccessible(filePath);
        return this.inner.readTextFile(filePath);
    }

    /**
     * 读取文件的原始字节内容。
     * @param filePath 文件绝对路径。
     * @returns 文件的二进制内容。
     */
    public async readBinaryFile(filePath: string): Promise<Buffer> {
        await this.ensureAccessible(filePath);
        return this.inner.readBinaryFile(filePath);
    }

    /**
     * 计算目录内所有普通文件的总大小。
     * @param directoryPath 目录绝对路径。
     * @returns 文件总大小，单位为字节；遍历失败时直接抛出错误。
     */
    public async getDirectorySize(directoryPath: string): Promise<number> {
        await this.ensureAccessible(directoryPath);
        return this.inner.getDirectorySize(directoryPath);
    }

    /**
     * 复制普通文件。
     * @param sourcePath 源文件绝对路径。
     * @param targetPath 目标文件绝对路径；目标路径的目录需已存在。
     */
    public async copyFile(sourcePath: string, targetPath: string): Promise<void> {
        await this.ensureAccessible(sourcePath, targetPath);
        await this.inner.copyFile(sourcePath, targetPath);
    }

    /**
     * 写入 UTF-8 文本文件。
     * @param filePath 文件绝对路径。
     * @param content 待写入的文本内容。
     */
    public async writeTextFile(filePath: string, content: string): Promise<void> {
        await this.ensureAccessible(filePath);
        await this.inner.writeTextFile(filePath, content);
    }

    /**
     * 移动或重命名文件。
     * @param sourcePath 原文件绝对路径。
     * @param targetPath 目标文件绝对路径。
     */
    public async moveFile(sourcePath: string, targetPath: string): Promise<void> {
        await this.ensureAccessible(sourcePath, targetPath);
        await this.inner.moveFile(sourcePath, targetPath);
    }

    /**
     * 删除文件；文件不存在时不报错。
     * @param filePath 待删除的文件绝对路径。
     */
    public async removeFileIfExists(filePath: string): Promise<void> {
        await this.ensureAccessible(filePath);
        await this.inner.removeFileIfExists(filePath);
    }

    /**
     * 删除目录及其全部内容；目录不存在时不报错。
     * @param directoryPath 待删除的目录绝对路径。
     */
    public async removeDirectoryIfExists(directoryPath: string): Promise<void> {
        await this.ensureAccessible(directoryPath);
        await this.inner.removeDirectoryIfExists(directoryPath);
    }

    /**
     * 列出目录中的普通文件名。
     * @param directoryPath 目录绝对路径。
     * @returns 目录下普通文件的名称，不包含目录路径。
     */
    public async listFileNames(directoryPath: string): Promise<string[]> {
        await this.ensureAccessible(directoryPath);
        return this.inner.listFileNames(directoryPath);
    }

    /**
     * 列出目录中的子目录名。
     * @param directoryPath 目录绝对路径。
     * @returns 目录下子目录的名称，不包含目录路径。
     */
    public async listDirectoryNames(directoryPath: string): Promise<string[]> {
        await this.ensureAccessible(directoryPath);
        return this.inner.listDirectoryNames(directoryPath);
    }

    /**
     * 删除目录下已经为空的子目录。
     * @param directoryPath 待清理的根目录。
     */
    public async removeEmptySubdirectories(directoryPath: string): Promise<void> {
        await this.ensureAccessible(directoryPath);
        await this.inner.removeEmptySubdirectories(directoryPath);
    }

    /**
     * 判断路径是否明确不存在。
     * @param targetPath 待检查的路径。
     * @returns 路径明确不存在时返回 `true`。
     */
    public async pathIsMissing(targetPath: string): Promise<boolean> {
        await this.ensureAccessible(targetPath);
        return this.inner.pathIsMissing(targetPath);
    }
}
