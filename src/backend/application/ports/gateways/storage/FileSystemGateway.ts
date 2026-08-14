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
}
