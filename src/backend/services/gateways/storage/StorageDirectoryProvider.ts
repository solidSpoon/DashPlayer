import { StorageStatusVO } from '@/common/types/vo/StorageStatusVO';

/**
 * 外部存储目录目标。
 *
 * 说明：
 * - 仅表示用户可配置的外部存储目录；
 * - 不包含数据库、日志等应用内部状态目录。
 */
export enum StorageDirectoryTarget {
    LIBRARY_ROOT = 'library_root',
    FAVORITE_CLIPS = 'favorite_clips',
    FAVORITE_CLIPS_COLLECTION = 'favorite_clips_collection',
    WORD_VIDEO = 'word_video',
    VIDEOS = 'videos',
    TEMP = 'temp',
    TEMP_OSS = 'temp_oss',
    MODELS = 'models',
}

/**
 * 外部存储目录提供器。
 */
export default interface StorageDirectoryProvider {
    /**
     * 提供指定目标对应的可写目录。
     *
     * 行为说明：
     * - 会基于当前配置解析目标目录；
     * - 会在需要时尝试恢复外部根目录访问权限；
     * - 返回前确保目标目录已存在。
     *
     * @param target 目录目标。
     * @returns 可直接读写的绝对目录路径。
     */
    provideDirectory(target: StorageDirectoryTarget): Promise<string>;

    /**
     * 当路径已存在时，确保其所在位置具备访问权限。
     *
     * 行为说明：
     * - 仅用于存储目录体系之外的外部路径访问场景；
     * - 传入文件时，仅对其所在文件夹做权限恢复；
     * - 传入文件夹时，对该文件夹本身做权限恢复；
     * - 路径不存在时直接返回，不做创建，也不抛出缺失错误；
     * - 存储目录体系内部的目录应优先通过 `provideDirectory(...)` 获取，不要调用此方法重复做权限校验。
     *
     * @param targetPath 外部文件或文件夹绝对路径。
     */
    ensurePathAccessPermissionIfExists(targetPath: string): Promise<void>;

    /**
     * 解析指定配置路径对应的媒体库根目录状态。
     *
     * 行为说明：
     * - 仅做解析与访问状态检查，不触发目录创建，也不弹出权限恢复弹窗；
     * - 用于设置保存前的路径校验，避免和目录提供器的主动创建/恢复流程耦合。
     *
     * @param configuredPath 用户保存的原始路径；为空时按默认媒体库目录解析。
     * @returns 媒体库根目录健康状态。
     */
    getRootStatus(configuredPath?: string): Promise<StorageStatusVO>;
}
