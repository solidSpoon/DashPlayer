import {
    InsertSubtitleTimestampAdjustment,
    SubtitleTimestampAdjustment
} from '@/backend/infrastructure/db/tables/subtitleTimestampAdjustment';

/**
 * 调整字幕时间
 */
export default interface SrtTimeAdjustService {

    /**
     * 记录调整
     * @param e
     */
    record(e: InsertSubtitleTimestampAdjustment): Promise<void>;

    /**
     * 删除调整
     * @param key
     */
    deleteByKey(key: string): Promise<void>;

    /**
     * 删除调整
     * @param fileHash
     */
    deleteByFile(fileHash: string): Promise<void>;

    /**
     * 获取调整
     * @param key
     */
    getByKey(key: string): Promise<SubtitleTimestampAdjustment | undefined>;

    /**
     * 获取调整
     * @param subtitlePath
     */
    getByPath(subtitlePath: string): Promise<SubtitleTimestampAdjustment[]>;

    /**
     * 获取调整
     * @param h
     */
    getByHash(h: string): Promise<SubtitleTimestampAdjustment[]>;
}
