import { backendClient } from '@/fronted/infrastructure/electron/backendClient';

export const convertApi = {
    /**
     * 打开文件选择器并返回用户选中的待转换文件。
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
     * 扫描目录并找出需要转换的视频。
     *
     * @param folders 待扫描的文件夹绝对路径。
     * @returns 按文件夹分组的待转换视频。
     */
    scanFolders: (folders: string[]) => backendClient.call('convert/from-folder', folders),

    /**
     * 启动单个视频的 MP4 转换任务。
     *
     * @param file 待转换视频的绝对路径。
     * @returns 后端任务编号。
     */
    startConversion: (file: string) => backendClient.call('convert/to-mp4', file),

    /**
     * 获取视频指定时间点的缩略图。
     *
     * @param filePath 视频绝对路径。
     * @param time 截图时间，单位为秒。
     * @returns 缩略图文件路径。
     */
    getThumbnail: (filePath: string, time: number) => backendClient.call('media/thumbnail', { filePath, time }),

    /**
     * 获取视频时长。
     *
     * @param file 视频绝对路径。
     * @returns 视频时长，单位为秒。
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
    openFolder: (path: string) => backendClient.call('system/open-folder', path),
};
