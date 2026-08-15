import { backendClient } from '@/fronted/application/bootstrap/backendClient';

export const transcriptApi = {
    /**
     * 查询本地转录模型是否可用。
     *
     * @returns 当前模型状态。
     */
    getModelStatus: () => backendClient.call('parakeet/models/status'),

    /**
     * 启动指定视频的转录任务。
     *
     * @param filePath 视频绝对路径。
     * @returns 后端接受任务后结束。
     */
    startTranscription: (filePath: string) => backendClient.call('ai-func/transcript', { filePath }),

    /**
     * 取消指定视频的转录任务。
     *
     * @param filePath 视频绝对路径。
     * @returns 是否成功取消后端任务。
     */
    cancelTranscription: (filePath: string) => backendClient.call('ai-func/cancel-transcription', { filePath }),

    /**
     * 将文件加入观看历史。
     *
     * @param paths 文件绝对路径列表。
     * @returns 创建完成后结束。
     */
    createWatchHistory: (paths: string[]) => backendClient.call('watch-history/create', paths),

    /**
     * 为视频关联字幕。
     *
     * @param videoPath 视频绝对路径。
     * @param srtPath 字幕绝对路径，传入 same 时由后端使用同名字幕。
     * @returns 关联完成后结束。
     */
    attachSubtitle: (videoPath: string, srtPath: string) => backendClient.call('watch-history/attach-srt', {
        videoPath,
        srtPath,
    }),

    /**
     * 查询文件路径的展示信息。
     *
     * @param path 文件绝对路径。
     * @returns 文件名、目录名和扩展名。
     */
    getPathInfo: (path: string) => backendClient.call('system/path-info', path),

    /**
     * 在系统文件管理器中显示指定路径。
     *
     * @param path 文件或文件夹绝对路径。
     * @returns 文件管理器打开后结束。
     */
    openFolder: (path: string) => backendClient.call('system/open-folder', path),
};
