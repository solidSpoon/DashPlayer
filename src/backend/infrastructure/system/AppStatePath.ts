import path from 'path';
import { app } from 'electron';
import { getEnvironmentSuffix } from '@/backend/utils/runtimeEnv';

/**
 * 应用内部状态目录类型。
 */
export enum AppStateDirectoryType {
    DATA = 'data',
    LOGS = 'logs',
}

/**
 * 获取应用内部状态根目录。
 * @returns Electron `userData` 目录。
 */
export function getAppStateBasePath(): string {
    return app.getPath('userData');
}

/**
 * 获取应用内部状态子目录。
 *
 * 开发环境会在目录名后追加 `-dev`，确保数据库、日志等内部状态不会与
 * 已安装的生产版本互相读写。
 *
 * @param type 内部状态目录类型。
 * @returns 对应绝对路径。
 */
export function getAppStatePath(type: AppStateDirectoryType): string {
    const environmentDirectoryName = `${type}${getEnvironmentSuffix()}`;
    return path.join(getAppStateBasePath(), environmentDirectoryName);
}
