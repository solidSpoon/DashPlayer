/**
 * Pi 运行环境下载阶段。
 */
export type PiRuntimeDownloadPhase = 'idle' | 'resolving' | 'downloading' | 'verifying' | 'extracting';

/**
 * Pi 二进制运行环境状态视图对象。
 */
export interface PiRuntimeStatusVO {
    /** 当前平台与架构是否支持下载官方预编译二进制。 */
    platformSupported: boolean;
    /** 当前平台标识（如 darwin-arm64、win32-x64）。 */
    platformKey: string;
    /** 是否已在应用受管目录完成安装。 */
    installed: boolean;
    /** 已安装版本号（若可识别）。 */
    version: string | null;
    /** 受管二进制可执行文件绝对路径；未安装时为 null。 */
    executablePath: string | null;
    /** 受管运行环境安装目录。 */
    installDir: string;
    /** 当前是否正在下载安装。 */
    downloading: boolean;
    /** 当前下载阶段。 */
    phase: PiRuntimeDownloadPhase;
    /** 下载进度（0-100）。 */
    percent: number;
    /** 平台不支持或状态异常时的说明。 */
    message?: string;
}

/**
 * Pi 运行环境下载进度事件载荷。
 */
export interface PiRuntimeDownloadProgress {
    /** 下载进度百分比（0-100）。 */
    percent: number;
    /** 已下载字节数。 */
    downloaded: number;
    /** 总字节数（未知时为 0）。 */
    total: number;
    /** 当前阶段。 */
    phase: PiRuntimeDownloadPhase;
}
