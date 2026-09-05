/**
 * 媒体库存储用量统计值对象。
 *
 * 按固定子目录分类统计媒体库占用，供设置页的存储用量图表展示。
 */

/**
 * 存储用量分类键。
 *
 * - `videos` / `models` / `temp` 对应媒体库下的同名目录，其中 `temp` 合并 `temp` 与 `temp_oss`；
 * - `word_clips` 对应 `favorite_clips/word_video`；
 * - `favorite_clips` 仅统计 `favorite_clips` 下除 `word_video` 外的内容；
 * - `other` 统计未纳入上述分类的其余文件。
 */
export type StorageUsageCategory =
    | 'videos'
    | 'favorite_clips'
    | 'word_clips'
    | 'models'
    | 'temp'
    | 'other';

/** 单个分类的占用大小。 */
export interface StorageUsageItemVO {
    /** 分类键。 */
    category: StorageUsageCategory;
    /** 该分类下所有文件的总大小，单位字节。 */
    bytes: number;
}

/** 媒体库存储用量统计结果。 */
export interface StorageUsageVO {
    /** 媒体库内全部文件的总大小，单位字节。 */
    totalBytes: number;
    /** 各分类占用明细，按大小降序排列；仅包含大小大于 0 的分类。 */
    items: StorageUsageItemVO[];
}
