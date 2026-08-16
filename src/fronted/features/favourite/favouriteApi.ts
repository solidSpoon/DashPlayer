import { backendClient } from '@/fronted/infrastructure/electron/backendClient';
import { ClipQuery } from '@/common/api/dto';

/**
 * 收藏片段功能调用的后端接口。
 */
export const favouriteApi = {
    /**
     * 查询收藏片段任务信息。
     *
     * @returns 当前收藏任务状态。
     */
    getTaskInfo: () => backendClient.call('favorite-clips/task-info'),

    /**
     * 搜索收藏片段。
     *
     * @param params 搜索条件。
     * @returns 收藏片段查询结果。
     */
    search: (params?: ClipQuery) => backendClient.call('favorite-clips/search', params),

    /**
     * 从远端同步收藏片段。
     *
     * @returns 同步完成后结束。
     */
    syncFromOss: () => backendClient.call('favorite-clips/sync-from-oss'),

    /**
     * 查询片段标签。
     *
     * @param videoKey 视频标识。
     * @returns 标签列表。
     */
    queryClipTags: (videoKey: string) => backendClient.call('favorite-clips/query-clip-tags', videoKey),

    /**
     * 为收藏片段添加标签。
     *
     * @param params 标签关联参数。
     * @returns 添加完成后结束。
     */
    addClipTag: (params: { key: string; tagId: number }) =>
        backendClient.call('favorite-clips/add-clip-tag', params),

    /**
     * 添加标签。
     *
     * @param name 标签名称。
     * @returns 新建标签。
     */
    addTag: (name: string) => backendClient.call('tag/add', name),

    /**
     * 更新标签。
     *
     * @param params 标签标识和新名称。
     * @returns 更新完成后结束。
     */
    updateTag: (params: { id: number; name: string }) => backendClient.call('tag/update', params),

    /**
     * 删除收藏片段标签。
     *
     * @param params 标签关联参数。
     * @returns 删除完成后结束。
     */
    deleteClipTag: (params: { key: string; tagId: number }) =>
        backendClient.call('favorite-clips/delete-clip-tag', params),

    /**
     * 搜索标签。
     *
     * @param query 标签搜索条件。
     * @returns 匹配的标签列表。
     */
    searchTags: (query: string) => backendClient.call('tag/search', query),

    /**
     * 取消添加收藏片段。
     *
     * @param params 片段字幕位置参数。
     * @returns 取消完成后结束。
     */
    cancelAdd: (params: { srtKey: string; indexInSrt: number }) =>
        backendClient.call('favorite-clips/cancel-add', params),

    /**
     * 添加收藏片段。
     *
     * @param params 收藏片段参数。
     * @returns 添加完成后结束。
     */
    add: (params: { videoPath: string; srtKey: string; indexInSrt: number }) =>
        backendClient.call('favorite-clips/add', params),

    /**
     * 查询收藏片段是否已存在。
     *
     * @param params 片段定位参数。
     * @returns 是否存在。
     */
    exists: (params: { srtKey: string; linesInSrt: number[] }) =>
        backendClient.call('favorite-clips/exists', params),

    /**
     * 删除收藏片段。
     *
     * @param key 收藏片段标识。
     * @returns 删除完成后结束。
     */
    delete: (key: string) => backendClient.call('favorite-clips/delete', key),

    /**
     * 批量翻译收藏片段。
     *
     * @param params 翻译请求参数。
     * @returns 翻译结果。
     */
    translate: (params: string[]) => backendClient.call('favorite-clips/translate', params),
};
