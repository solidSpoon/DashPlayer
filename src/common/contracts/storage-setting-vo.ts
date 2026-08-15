/**
 * 存储设置详情/保存值对象。
 *
 * 当前仅包含媒体库根目录；收藏集合固定为 `default`，不再暴露为可配置项。
 */
export interface StorageSettingVO {
    /** 媒体库根目录原始路径；为空表示使用默认媒体库目录。 */
    path: string;
}
