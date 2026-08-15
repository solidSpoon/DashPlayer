import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { getEnvironmentSuffix } from '@/backend/utils/runtimeEnv';
import StrUtil from '@/common/utils/str-util';
import { StorageStatusVO } from '@/common/types/vo/StorageStatusVO';
import { StorageDirectoryTarget } from '@/backend/services/gateways/storage/StorageDirectoryProvider';

const DEFAULT_STORAGE_FOLDER_NAME = 'DashPlayer';
const DEFAULT_COLLECTION = 'default';

/**
 * 路径访问检查类型。
 */
export type StorageAccessTargetType = 'directory' | 'file';

/**
 * 路径访问检查结果代码。
 */
export type StorageAccessStatusCode =
    | 'ok'
    | 'missing'
    | 'not_directory'
    | 'not_file'
    | 'not_readable'
    | 'not_writable';

/**
 * 路径访问检查结果。
 */
export interface StorageAccessStatus {
    /** 当前检查的目标路径。 */
    targetPath: string;
    /** 当前用于访问校验的实际路径。文件缺失时会退化为其所在文件夹。 */
    checkPath: string;
    /** 当前目标类型。 */
    targetType: StorageAccessTargetType;
    /** 当前目标路径是否存在。 */
    exists: boolean;
    /** 当前目标路径是否为目录。 */
    isDirectory: boolean;
    /** 当前目标路径是否为文件。 */
    isFile: boolean;
    /** 当前检查路径是否具备读取权限。 */
    readable: boolean;
    /** 当前检查路径是否具备写入权限。 */
    writable: boolean;
    /** 当前目标是否已可访问。 */
    available: boolean;
    /** 访问检查结果代码。 */
    code: StorageAccessStatusCode;
    /** 校验结果说明。 */
    message: string;
}

/**
 * 解析外部存储根目录。
 * @param configuredPath 用户保存的原始路径。
 * @returns 带环境后缀的最终根目录。
 */
export function resolveStorageRootPath(configuredPath?: string | null): string {
    let rawPath = configuredPath;
    if (StrUtil.isBlank(rawPath)) {
        rawPath = path.join(app.getPath('documents'), DEFAULT_STORAGE_FOLDER_NAME);
    }

    const dirName = path.basename(rawPath);
    const parentDir = path.dirname(rawPath);
    const baseName = dirName.endsWith('-dev')
        ? dirName.slice(0, -4)
        : dirName;
    const finalName = `${baseName}${getEnvironmentSuffix()}`;

    if (finalName !== dirName) {
        return path.join(parentDir, finalName);
    }

    return rawPath;
}

/**
 * 获取外部存储根目录状态。
 * @param configuredPath 用户保存的原始路径。
 * @returns 可供前端展示的状态信息。
 */
export function getStorageRootStatus(configuredPath?: string): StorageStatusVO {
    const resolvedPath = resolveStorageRootPath(configuredPath);
    const accessStatus = getDirectoryAccessStatus(resolvedPath);
    const status: StorageStatusVO = {
        configuredPath: configuredPath ?? '',
        resolvedPath,
        exists: accessStatus.exists,
        isDirectory: accessStatus.isDirectory,
        readable: accessStatus.readable,
        writable: accessStatus.writable,
        available: accessStatus.available,
        code: accessStatus.code === 'not_file' ? 'not_directory' : accessStatus.code,
        message: accessStatus.available
            ? `当前存储目录可用：${resolvedPath}`
            : `当前存储目录暂时无法访问：${resolvedPath}`,
    };
    return status;
}

/**
 * 获取目录路径访问状态。
 * @param directoryPath 目录绝对路径。
 * @returns 目录访问状态。
 */
export function getDirectoryAccessStatus(directoryPath: string): StorageAccessStatus {
    const targetPath = path.resolve(directoryPath);
    return buildAccessStatus(targetPath, 'directory');
}

/**
 * 获取文件路径访问状态。
 *
 * 行为说明：
 * - 文件已存在时校验文件本身；
 * - 文件不存在时校验其所在文件夹，便于后续创建或覆盖。
 *
 * @param filePath 文件绝对路径。
 * @returns 文件访问状态。
 */
export function getFileAccessStatus(filePath: string): StorageAccessStatus {
    const targetPath = path.resolve(filePath);
    return buildAccessStatus(targetPath, 'file');
}

/**
 * 判断用户选择是否能够覆盖目标路径的访问恢复。
 *
 * 规则说明：
 * - 无论原目标是文件还是文件夹，恢复时都要求用户选择目标自身对应的文件夹，或包含它的上层文件夹。
 *
 * @param targetPath 原目标路径。
 * @param selectedDirectoryPath 用户选择的文件夹路径。
 * @returns 是否满足恢复访问的选择要求。
 */
export function canRecoverAccessFromSelection(
    targetPath: string,
    selectedDirectoryPath: string,
): boolean {
    const normalizedTargetPath = path.resolve(targetPath);
    const normalizedSelectedPath = path.resolve(selectedDirectoryPath);

    return isSamePathOrAncestor(normalizedSelectedPath, normalizedTargetPath);
}

/**
 * 判断祖先路径是否覆盖目标路径。
 * @param candidateAncestor 候选祖先路径。
 * @param targetPath 目标路径。
 * @returns 是否为同一路径或祖先路径。
 */
function isSamePathOrAncestor(candidateAncestor: string, targetPath: string): boolean {
    if (candidateAncestor === targetPath) {
        return true;
    }
    const relativePath = path.relative(candidateAncestor, targetPath);
    return relativePath !== '' && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
}

/**
 * 构建统一的路径访问状态。
 * @param targetPath 目标路径。
 * @param targetType 目标类型。
 * @returns 标准化后的访问状态。
 */
function buildAccessStatus(targetPath: string, targetType: StorageAccessTargetType): StorageAccessStatus {
    const status: StorageAccessStatus = {
        targetPath,
        checkPath: targetType === 'file' ? path.dirname(targetPath) : targetPath,
        targetType,
        exists: false,
        isDirectory: false,
        isFile: false,
        readable: false,
        writable: false,
        available: false,
        code: 'missing',
        message: targetType === 'file' ? '当前文件暂时无法访问' : '当前文件夹暂时无法访问',
    };

    try {
        const stat = fs.statSync(targetPath);
        status.exists = true;
        status.isDirectory = stat.isDirectory();
        status.isFile = stat.isFile();
        status.checkPath = targetPath;
    } catch (error: unknown) {
        const errorCode = error instanceof Error && 'code' in error
            ? (error as NodeJS.ErrnoException).code
            : undefined;
        if (errorCode !== 'ENOENT') {
            status.message = targetType === 'file' ? '当前文件暂时无法访问' : '当前文件夹暂时无法访问';
            return status;
        }
    }

    if (status.exists) {
        if (targetType === 'directory' && !status.isDirectory) {
            status.code = 'not_directory';
            return status;
        }
        if (targetType === 'file' && !status.isFile) {
            status.code = 'not_file';
            return status;
        }
    } else {
        status.checkPath = findNearestExistingAncestor(targetPath, targetType);
    }

    try {
        fs.accessSync(status.checkPath, fs.constants.R_OK);
        status.readable = true;
    } catch {
        status.code = 'not_readable';
        return status;
    }

    try {
        fs.accessSync(status.checkPath, fs.constants.W_OK);
        status.writable = true;
    } catch {
        status.code = 'not_writable';
        return status;
    }

    status.available = true;
    status.code = 'ok';
    status.message = targetType === 'file' ? '当前文件可访问' : '当前文件夹可访问';
    return status;
}

/**
 * 查找目标路径最近的已存在上层路径。
 * @param targetPath 目标路径。
 * @param targetType 目标类型。
 * @returns 最近的已存在上层路径；若无法判断则回退到初始检查路径。
 */
function findNearestExistingAncestor(targetPath: string, targetType: StorageAccessTargetType): string {
    const candidatePath = targetType === 'file' ? path.dirname(targetPath) : targetPath;
    return findExistingAncestor(candidatePath);
}

/**
 * 递归查找最近的已存在路径。
 * @param candidatePath 当前候选路径。
 * @returns 最近的已存在路径；若遇到非缺失错误则返回当前路径。
 */
function findExistingAncestor(candidatePath: string): string {
    try {
        fs.statSync(candidatePath);
        return candidatePath;
    } catch (error: unknown) {
        const errorCode = error instanceof Error && 'code' in error
            ? (error as NodeJS.ErrnoException).code
            : undefined;
        if (errorCode !== 'ENOENT') {
            return candidatePath;
        }
    }

    const parentPath = path.dirname(candidatePath);
    if (parentPath === candidatePath) {
        return candidatePath;
    }
    return findExistingAncestor(parentPath);
}

/**
 * 解析指定目标目录。
 * @param rootPath 已确认的外部存储根目录。
 * @param target 目录目标。
 * @returns 对应目标目录。
 */
export function resolveStorageDirectory(rootPath: string, target: StorageDirectoryTarget): string {
    switch (target) {
        case StorageDirectoryTarget.LIBRARY_ROOT:
            return rootPath;
        case StorageDirectoryTarget.FAVORITE_CLIPS:
            return path.join(rootPath, 'favorite_clips');
        case StorageDirectoryTarget.FAVORITE_CLIPS_COLLECTION:
            return path.join(rootPath, 'favorite_clips', DEFAULT_COLLECTION);
        case StorageDirectoryTarget.WORD_VIDEO:
            return path.join(rootPath, 'favorite_clips', 'word_video');
        case StorageDirectoryTarget.VIDEOS:
            return path.join(rootPath, 'videos');
        case StorageDirectoryTarget.TEMP:
            return path.join(rootPath, 'temp');
        case StorageDirectoryTarget.TEMP_OSS:
            return path.join(rootPath, 'temp_oss');
        case StorageDirectoryTarget.MODELS:
            return path.join(rootPath, 'models');
        default:
            throw new Error(`未知的外部目录目标：${target satisfies never}`);
    }
}
