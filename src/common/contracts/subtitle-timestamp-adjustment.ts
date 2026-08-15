/**
 * 字幕时间调整记录。
 */
export interface SubtitleTimestampAdjustment {
    /** 数据库记录编号。 */
    id: number;
    /** 字幕行的稳定调整键。 */
    key: string;
    /** 历史字幕路径字段。 */
    subtitle_path: string | null;
    /** 字幕文件哈希。 */
    subtitle_hash: string | null;
    /** 调整后的开始时间，单位为毫秒。 */
    start_at: number | null;
    /** 调整后的结束时间，单位为毫秒。 */
    end_at: number | null;
    /** UTC 创建时间。 */
    created_at: string;
    /** UTC 更新时间。 */
    updated_at: string;
}

/**
 * 新增或覆盖字幕时间调整记录时允许提交的字段。
 */
export type SubtitleTimestampAdjustmentInput = Partial<SubtitleTimestampAdjustment> & {
    /** 字幕行的稳定调整键。 */
    key: string;
};
