import { backendClient } from '@/fronted/infrastructure/electron/backendClient';

/**
 * 文件浏览功能调用的后端接口。
 */
export const fileBrowserApi = {
    /**
     * 切换主窗口展示模式。
     *
     * @param state 目标窗口模式。
     * @returns 窗口切换完成后结束。
     */
    changeWindowSize: (state: 'home' | 'player') => backendClient.call('system/window-size/change', state),

    /**
     * 查询首页展示的近期观看记录。
     *
     * @returns 基础观看记录列表。
     */
    listBasicWatchHistory: () => backendClient.call('watch-history/list/basic'),

    /**
     * 查询完整观看记录。
     *
     * @returns 完整观看记录列表。
     */
    listWatchHistory: () => backendClient.call('watch-history/list'),

    /**
     * 查询指定视频的观看记录详情。
     *
     * @param videoId 视频标识。
     * @returns 观看记录详情。
     */
    getWatchHistoryDetail: (videoId: string) => backendClient.call('watch-history/detail', videoId),

    /**
     * 创建观看记录。
     *
     * @param paths 视频或目录路径列表。
     * @returns 创建的观看记录标识列表。
     */
    createWatchHistory: (paths: string[]) => backendClient.call('watch-history/create', paths),

    /**
     * 关联视频和字幕文件。
     *
     * @param videoPath 视频路径。
     * @param srtPath 字幕路径。
     * @returns 关联完成后结束。
     */
    attachSubtitle: (videoPath: string, srtPath: string) =>
        backendClient.call('watch-history/attach-srt', { videoPath, srtPath }),

    /**
     * 删除观看记录分组。
     *
     * @param groupId 观看记录分组标识。
     * @returns 删除完成后结束。
     */
    deleteWatchHistoryGroup: (groupId: string) => backendClient.call('watch-history/group-delete', groupId),

    /**
     * 打开文件夹。
     *
     * @param path 文件夹路径。
     * @returns 文件夹打开后结束。
     */
    openFolder: (path: string) => backendClient.call('system/open-folder', { path }),

    /**
     * 选择文件。
     *
     * @param formats 允许的文件扩展名。
     * @returns 用户选择的文件路径列表。
     */
    selectFiles: (formats: string[]) => backendClient.call('system/select-file', formats),

    /**
     * 选择文件夹。
     *
     * @param options 文件夹选择选项。
     * @returns 用户选择的文件夹路径列表。
     */
    selectFolder: (options: { defaultPath?: string; createDirectory?: boolean }) =>
        backendClient.call('system/select-folder', options),

    /**
     * 获取媒体缩略图。
     *
     * @param filePath 媒体文件路径。
     * @param time 截图时间，单位为秒。
     * @returns 缩略图路径。
     */
    getThumbnail: (filePath: string, time: number) => backendClient.call('media/thumbnail', { filePath, time }),

    /**
     * 查询指定路径下的基础观看记录。
     *
     * @param basePath 基础目录路径。
     * @returns 基础观看记录列表。
     */
    listBasicWatchHistoryByPath: (basePath: string) => backendClient.call('watch-history/list/basic', basePath),

    /**
     * 查询指定路径下的完整观看记录。
     *
     * @param basePath 基础目录路径。
     * @returns 完整观看记录列表。
     */
    listWatchHistoryByPath: (basePath: string) => backendClient.call('watch-history/list', basePath),

};
