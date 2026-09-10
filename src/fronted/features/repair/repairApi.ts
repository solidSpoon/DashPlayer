import { backendClient } from '@/fronted/infrastructure/electron/backendClient';

export const repairApi = {
    /**
     * 打开文件选择器并返回用户选中的待修复文件。
     *
     * @param formats 允许选择的文件扩展名。
     * @returns 用户选中的文件绝对路径。
     */
    selectFiles: (formats: string[]) => backendClient.call('system/select-file', formats),

    /**
     * 打开文件夹选择器并返回用户选中的目录。
     *
     * @returns 用户选中的文件夹绝对路径。
     */
    selectFolders: () => backendClient.call('system/select-folder', {}),

    /**
     * 扫描目录并找出需要修复的媒体文件。
     *
     * @param folders 待扫描的文件夹绝对路径。
     * @returns 按文件夹分组的待修复文件。
     */
    scanFolders: (folders: string[]) => backendClient.call('repair/scan-folders', folders),

    /**
     * 诊断单个媒体文件是否需要修复。
     *
     * @param file 待诊断媒体绝对路径。
     * @returns 诊断结论；已修复时 `needsRepair` 为 false。
     */
    diagnose: (file: string) => backendClient.call('repair/diagnose', file),

    /**
     * 诊断并启动单个媒体的修复任务。
     *
     * @param file 待修复媒体绝对路径。
     * @returns 任务编号与诊断结论；无需修复时任务编号为 null。
     */
    startRepair: (file: string) => backendClient.call('repair/start', file),

    /**
     * 丢弃某个媒体的修复产物。
     *
     * 用于产物在真机试播验收中仍不可播的场景：产物留着会被后续播放优先选中。
     *
     * @param file 原媒体或产物绝对路径。
     * @returns 产物存在并被删除时返回 true。
     */
    discard: (file: string) => backendClient.call('repair/discard', file),

    /**
     * 获取媒体指定时间点的缩略图。
     *
     * @param filePath 媒体绝对路径。
     * @param time 截图时间，单位为秒。
     * @returns 缩略图文件路径。
     */
    getThumbnail: (filePath: string, time: number) => backendClient.call('media/thumbnail', { filePath, time }),

    /**
     * 获取媒体时长。
     *
     * @param file 媒体绝对路径。
     * @returns 媒体时长，单位为秒。
     */
    getDuration: (file: string) => backendClient.call('media/duration', file),

    /**
     * 取消正在执行的后端任务。
     *
     * @param taskId 后端任务编号。
     * @returns 任务取消完成后结束。
     */
    cancelTask: (taskId: number) => backendClient.call('dp-task/cancel', taskId),

    /**
     * 在系统文件管理器中显示指定路径。
     *
     * @param path 文件或文件夹绝对路径。
     * @returns 文件管理器打开后结束。
     */
    openFolder: (path: string) => backendClient.call('system/open-folder', { path }),
};
