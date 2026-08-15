/**
 * 后端业务代码使用的文件系统访问入口。
 *
 * 仅提供当前业务确实需要的基础操作，路径规则和业务判断仍由 Service 负责。
 */
export default interface FileSystemGateway {
    /**
     * 确保目录存在。
     * @param directoryPath 目录绝对路径。
     */
    ensureDirectory(directoryPath: string): Promise<void>;

    /**
     * 判断普通文件是否存在。
     *
     * 路径存在但不是普通文件时会直接抛错，避免业务代码把同名目录误判为文件。
     *
     * @param filePath 待检查的文件绝对路径。
     * @returns 普通文件存在时返回 `true`。
     */
    fileExists(filePath: string): Promise<boolean>;

    /**
     * 判断目录是否存在。
     *
     * 路径不存在、上级路径不是目录或目标是普通文件时返回 `false`；其他文件系统错误继续抛出。
     *
     * @param directoryPath 待检查的目录绝对路径。
     * @returns 目录存在时返回 `true`，目标不是目录时返回 `false`。
     */
    directoryExists(directoryPath: string): Promise<boolean>;
    /**
     * 获取文件大小。
     * @param filePath 文件绝对路径。
     * @returns 文件大小，单位为字节。
     */
    getFileSize(filePath: string): Promise<number>;

    /**
     * 读取 UTF-8 文本文件。
     * @param filePath 文件绝对路径。
     * @returns 文件文本内容。
     */
    readTextFile(filePath: string): Promise<string>;

    /**
     * 写入 UTF-8 文本文件。
     * @param filePath 文件绝对路径。
     * @param content 待写入的文本内容。
     */
    writeTextFile(filePath: string, content: string): Promise<void>;

    /**
     * 移动或重命名文件。
     * @param sourcePath 原文件绝对路径。
     * @param targetPath 目标文件绝对路径。
     */
    moveFile(sourcePath: string, targetPath: string): Promise<void>;

    /**
     * 删除文件；文件不存在时不报错。
     *
     * 路径指向目录或删除失败时会直接抛错，避免遗留无效转换结果。
     *
     * @param filePath 待删除的文件绝对路径。
     */
    removeFileIfExists(filePath: string): Promise<void>;

    /**
     * 列出目录中的普通文件名。
     * @param directoryPath 目录绝对路径。
     * @returns 目录下普通文件的名称，不包含目录路径。
     */
    listFileNames(directoryPath: string): Promise<string[]>;

    /**
     * 列出目录中的子目录名。
     * @param directoryPath 目录绝对路径。
     * @returns 目录下子目录的名称，不包含目录路径。
     */
    listDirectoryNames(directoryPath: string): Promise<string[]>;

    /**
     * 删除目录下已经为空的子目录。
     *
     * 目标目录本身不会删除；无法读取或删除目录时直接抛出错误。
     *
     * @param directoryPath 待清理的根目录。
     */
    removeEmptySubdirectories(directoryPath: string): Promise<void>;

    /**
     * 判断路径是否明确不存在。
     *
     * 只有路径不存在或上级路径不是目录时返回 `true`；权限等其他错误继续抛出。
     *
     * @param targetPath 待检查的路径。
     * @returns 路径明确不存在时返回 `true`。
     */
    pathIsMissing(targetPath: string): Promise<boolean>;
}
