import { backendClient } from '@/fronted/application/bootstrap/backendClient';
import { ChapterParseResult } from '@/common/types/chapter-result';

export const splitApi = {
    /**
     * 打开文件选择器并返回用户选中的媒体或字幕文件。
     *
     * @param formats 允许选择的文件扩展名。
     * @returns 用户选中的文件绝对路径。
     */
    selectFiles: (formats: string[]) => backendClient.call('system/select-file', formats),

    /**
     * 查询文件路径的展示信息。
     *
     * @param path 文件绝对路径。
     * @returns 文件名、目录名和扩展名。
     */
    getPathInfo: (path: string) => backendClient.call('system/path-info', path),

    /**
     * 根据用户文本生成切分预览。
     *
     * @param input 用户输入的章节文本。
     * @returns 解析后的章节列表。
     */
    previewSplit: (input: string) => backendClient.call('split-video/preview', input),

    /**
     * 请求 AI 格式化章节文本。
     *
     * @param input 用户输入的原始章节文本。
     * @returns 后端任务编号。
     */
    formatSplit: (input: string) => backendClient.call('ai-func/format-split', input),

    /**
     * 按章节配置切分视频。
     *
     * @param params 视频、字幕与章节配置。
     * @returns 切分结果所在的文件夹路径。
     */
    splitVideo: (params: {
        videoPath: string;
        srtPath: string | null;
        chapters: ChapterParseResult[];
    }) => backendClient.call('split-video/split', params),

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
     * @param srtPath 字幕绝对路径。
     * @returns 关联完成后结束。
     */
    attachSubtitle: (videoPath: string, srtPath: string) => backendClient.call('watch-history/attach-srt', {
        videoPath,
        srtPath,
    }),

    /**
     * 删除观看历史分组。
     *
     * @param groupId 分组标识。
     * @returns 删除完成后结束。
     */
    deleteWatchHistoryGroup: (groupId: string) => backendClient.call('watch-history/group-delete', groupId),

    /**
     * 在系统文件管理器中显示指定路径。
     *
     * @param path 文件或文件夹绝对路径。
     * @returns 文件管理器打开后结束。
     */
    openFolder: (path: string) => backendClient.call('system/open-folder', path),
};
