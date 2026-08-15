import {
    SubtitleTimestampAdjustment,
    SubtitleTimestampAdjustmentInput,
} from '@/common/contracts/subtitle-timestamp-adjustment';

/**
 * 字幕时间调整记录持久化端口。
 */
export default interface SubtitleTimestampAdjustmentsRepository {
    upsert(values: SubtitleTimestampAdjustmentInput): Promise<void>;
    deleteByKey(key: string): Promise<void>;
    deleteByFileHash(fileHash: string): Promise<void>;
    findByKey(key: string): Promise<SubtitleTimestampAdjustment | undefined>;
    findByPath(subtitlePath: string): Promise<SubtitleTimestampAdjustment[]>;
    findByHash(hash: string): Promise<SubtitleTimestampAdjustment[]>;
}
