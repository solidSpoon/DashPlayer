import { SimpleClipQuery } from '@/common/api/dto';
import { ClipMeta } from '@/common/types/clipMeta';
import { backendClient } from '@/fronted/infrastructure/electron/backendClient';

/**
 * 视频学习功能调用的后端接口。
 */
export const videoLearningApi = {
    /**
     * 查询视频学习片段。
     *
     * @param query 片段筛选和分页条件。
     * @returns 分页片段结果。
     */
    search: (query: SimpleClipQuery) => backendClient.call('video-learning/search', query),

    /**
     * 查询词汇列表。
     *
     * @returns 后端返回的词汇数据。
     */
    getVocabulary: () => backendClient.call('vocabulary/get-all', {}),

    /**
     * 查询每个单词的片段统计。
     *
     * @returns 单词到片段数量与最近添加视频时间的映射。
     */
    getWordClipStats: () => backendClient.call('video-learning/word-clip-stats'),

    /**
     * 从远端同步视频学习数据。
     *
     * @returns 同步结果。
     */
    syncFromOss: () => backendClient.call('video-learning/sync-from-oss'),

    /**
     * 导出词汇导入模板。
     *
     * @returns 模板导出结果。
     */
    exportVocabularyTemplate: () => backendClient.call('vocabulary/export-template'),

    /**
     * 导入词汇文件。
     *
     * @param filePath Excel 文件绝对路径。
     * @returns 导入结果。
     */
    importVocabulary: (filePath: string) => backendClient.call('vocabulary/import', { filePath }),

    /**
     * 收藏单词到词汇工坊；后端负责还原为原始形态并入库。
     *
     * @param word 用户点击的单词原文（可能是变体）。
     * @param translate 弹窗词典已查到的释义；提供时后端不再另行调用词典 AI。
     * @returns 收藏结果，成功时携带入库单词与释义。
     */
    favoriteWord: (word: string, translate?: string) => backendClient.call('vocabulary/favorite', { word, translate }),

    /**
     * 编辑单词与释义；单词本身是业务键，需用旧单词定位。
     *
     * @param oldWord 编辑前的单词。
     * @param word 编辑后的单词。
     * @param translate 编辑后的释义。
     * @returns 操作结果。
     */
    updateWord: (oldWord: string, word: string, translate: string) =>
        backendClient.call('vocabulary/update', { oldWord, word, translate }),

    /**
     * 删除单词。
     *
     * @param word 待删除的单词。
     * @returns 操作结果。
     */
    deleteWord: (word: string) => backendClient.call('vocabulary/delete', { word }),

    /**
     * 调用 AI 为单词生成简明中文释义。
     *
     * @param word 单词。
     * @returns 生成结果，成功时携带释义文本。
     */
    generateDefinition: (word: string) => backendClient.call('vocabulary/generate-definition', { word }),

    /**
     * 打开词汇导入文件选择器。
     *
     * @returns 用户选中的 Excel 文件路径列表。
     */
    selectVocabularyFile: () => backendClient.call('system/select-file', ['.xlsx', '.xls']),

    /**
     * 获取视频指定时间点的缩略图。
     *
     * @param filePath 视频绝对路径。
     * @param time 截图时间，单位为秒。
     * @returns 缩略图路径。
     */
    getThumbnail: (filePath: string, time: number) => backendClient.call('media/thumbnail', { filePath, time }),

    /**
     * 将片段中的词汇解析为带词形信息的条目。
     *
     * @param lines 片段字幕行。
     * @param words 待解析的词汇。
     * @returns 词汇解析结果。
     */
    resolveClipVocabulary: (lines: ClipMeta['clip_content'], words: string[]) =>
        backendClient.call('video-learning/resolve-clip-vocabulary', { lines, words }),

    /**
     * 查询全局自动裁切队列状态。
     *
     * @returns 当前队列状态。
     */
    getClipQueueStatus: () => backendClient.call('video-learning/clip-queue-status'),

    /**
     * 查询指定视频字幕的自动裁切状态。
     *
     * @param videoPath 视频绝对路径。
     * @param srtKey 字幕文件哈希。
     * @param srtPath 字幕文件绝对路径。
     * @returns 当前裁切状态。
     */
    getClipStatus: (videoPath: string, srtKey: string, srtPath?: string) =>
        backendClient.call('video-learning/detect-clip-status', { videoPath, srtKey, srtPath }),

    /**
     * 取消全部自动裁切任务。
     *
     * @returns 取消结果。
     */
    cancelAllAutoClip: () => backendClient.call('video-learning/cancel-auto-clip-all'),

    /**
     * 为指定视频启动自动裁切。
     *
     * @param videoPath 视频绝对路径。
     * @param srtKey 字幕文件哈希。
     * @param srtPath 字幕文件绝对路径。
     * @returns 启动结果。
     */
    startAutoClip: (videoPath: string, srtKey: string, srtPath?: string) =>
        backendClient.call('video-learning/auto-clip', { videoPath, srtKey, srtPath }),
};
