import { backendClient } from '@/fronted/infrastructure/electron/backendClient';
import { SubtitleTimestampAdjustmentInput } from '@/common/contracts/subtitle-timestamp-adjustment';

/**
 * 播放器功能调用的后端接口。
 */
export const playerApi = {
    /**
     * 删除指定字幕文件的时间轴调整记录。
     *
     * @param fileHash 字幕文件哈希。
     * @returns 删除完成后结束。
     */
    deleteTimestampAdjustment: (fileHash: string) =>
        backendClient.call('subtitle-timestamp/delete/by-file-hash', fileHash),

    /**
     * 查询当前窗口展示模式。
     *
     * @returns 当前窗口模式。
     */
    getWindowState: () => backendClient.call('system/window-size'),

    /**
     * 切换窗口展示模式。
     *
     * @param state 目标窗口模式。
     * @returns 窗口切换完成后结束。
     */
    changeWindowSize: (state: 'normal' | 'fullscreen' | 'player' | 'home') =>
        backendClient.call('system/window-size/change', state),

    /**
     * 保存指定视频的播客模式偏好。
     *
     * @param videoId 视频标识。
     * @param podcastMode 是否启用播客模式。
     * @returns 保存完成后结束。
     */
    setPodcastModePreference: (videoId: string, podcastMode: boolean) =>
        backendClient.call('watch-history/set-podcast-mode-preference', { videoId, podcastMode }),

    /**
     * 请求一组字幕的异步翻译。
     *
     * @param fileHash 字幕文件哈希。
     * @param indices 待翻译字幕索引。
     * @param useCache 是否允许使用翻译缓存。
     * @returns 后端接受请求后结束。
     */
    requestGroupTranslation: (fileHash: string, indices: number[], useCache: boolean) =>
        backendClient.call('ai-trans/request-group-translation', { fileHash, indices, useCache }),

    /**
     * 查询指定视频的观看记录详情。
     *
     * @param videoId 视频标识。
     * @returns 观看记录详情。
     */
    getWatchHistoryDetail: (videoId: string | undefined) => {
        if (!videoId) {
            throw new Error('缺少视频标识，无法查询观看记录');
        }
        return backendClient.call('watch-history/detail', videoId);
    },

    /**
     * 查询完整观看记录。
     *
     * @returns 完整观看记录列表。
     */
    listWatchHistory: () => backendClient.call('watch-history/list'),

    /**
     * 设置窗口按钮可见性。
     *
     * @param visible 是否显示窗口按钮。
     * @returns 设置完成后结束。
     */
    setWindowButtonsVisibility: (visible: boolean) =>
        backendClient.call('system/window-buttons/visibility', visible),

    /**
     * 查询视频建议使用的字幕文件。
     *
     * @param videoPath 视频文件路径。
     * @returns 建议字幕路径。
     */
    suggestSubtitle: (videoPath: string) => backendClient.call('watch-history/suggest-srt', videoPath),

    /**
     * 建议将视频转换为 HTML5 可播放格式。
     *
     * @param videoPath 视频文件路径。
     * @returns 建议的视频路径。
     */
    suggestHtml5Video: (videoPath: string) => backendClient.call('convert/suggest-html5-video', videoPath),

    /**
     * 获取媒体信息。
     *
     * @param videoPath 视频文件路径。
     * @returns 媒体信息。
     */
    getMediaInfo: (videoPath: string) => backendClient.call('media/info', videoPath),

    /**
     * 获取视频缩略图。
     *
     * @param params 缩略图生成参数。
     * @returns 缩略图路径。
     */
    getThumbnail: (params: {
        filePath: string;
        time: number;
        quality?: 'low' | 'medium' | 'high' | 'ultra';
        width?: number;
        format?: 'jpg' | 'png';
    }) => backendClient.call('media/thumbnail', params),

    /**
     * 解析字幕为句子。
     *
     * @param subtitlePath 字幕文件路径。
     * @returns 解析后的句子列表。
     */
    parseSubtitleToSentences: (subtitlePath: string) =>
        backendClient.call('subtitle/srt/parse-to-sentences', subtitlePath),

    /**
     * 更新播放进度。
     *
     * @param params 播放进度参数。
     * @returns 更新完成后结束。
     */
    updateProgress: (params: { file: string; currentPosition: number }) =>
        backendClient.call('watch-history/progress/update', params),

    /**
     * 获取下一个视频。
     *
     * @param videoId 当前视频标识。
     * @returns 下一个视频信息。
     */
    getNextVideo: (videoId: string) => backendClient.call('watch-history/get-next-video', videoId),

    /**
     * 删除指定字幕句子的时间轴调整。
     *
     * @param key 时间轴调整记录标识。
     * @returns 删除完成后结束。
     */
    deleteTimestampAdjustmentByKey: (key: string) =>
        backendClient.call('subtitle-timestamp/delete/by-key', key),

    /**
     * 更新字幕句子的时间轴调整。
     *
     * @param params 时间轴调整参数。
     * @returns 更新完成后结束。
     */
    updateTimestampAdjustment: (params: SubtitleTimestampAdjustmentInput) =>
        backendClient.call('subtitle-timestamp/update', params),

    /**
     * 查询单词翻译。
     *
     * @param params 单词翻译请求参数。
     * @returns 单词翻译结果。
     */
    translateWord: (params: { word: string; forceRefresh?: boolean; requestId?: string }) =>
        backendClient.call('ai-trans/word', params),

};
