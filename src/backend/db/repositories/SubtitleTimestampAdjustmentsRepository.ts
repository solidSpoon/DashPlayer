import {
    InsertSubtitleTimestampAdjustment,
    SubtitleTimestampAdjustment,
} from '@/backend/db/tables/subtitleTimestampAdjustment';

export default interface SubtitleTimestampAdjustmentsRepository {
    upsert(values: InsertSubtitleTimestampAdjustment): Promise<void>;
    deleteByKey(key: string): Promise<void>;
    deleteByFileHash(fileHash: string): Promise<void>;
    findByKey(key: string): Promise<SubtitleTimestampAdjustment | undefined>;
    findByPath(subtitlePath: string): Promise<SubtitleTimestampAdjustment[]>;
    findByHash(hash: string): Promise<SubtitleTimestampAdjustment[]>;
}

