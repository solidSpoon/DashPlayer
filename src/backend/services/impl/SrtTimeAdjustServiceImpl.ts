import { eq } from 'drizzle-orm';
import db from '@/backend/db/db';
import {
    InsertSubtitleTimestampAdjustment,
    SubtitleTimestampAdjustment,
    subtitleTimestampAdjustments
} from '@/backend/db/tables/subtitleTimestampAdjustment';
import TimeUtil from '@/common/utils/TimeUtil';
import { injectable } from 'inversify';
import SrtTimeAdjustService from '@/backend/services/SrtTimeAdjustService';

@injectable()
export default class SrtTimeAdjustServiceImpl implements SrtTimeAdjustService {
    public async record(e: InsertSubtitleTimestampAdjustment): Promise<void> {
        await db
            .insert(subtitleTimestampAdjustments)
            .values(e)
            .onConflictDoUpdate({
                target: subtitleTimestampAdjustments.key,
                set: {
                    subtitle_path: e.subtitle_path,
                    start_at: e.start_at,
                    end_at: e.end_at,
                    updated_at: TimeUtil.timeUtc()
                }
            });
    }

    public async deleteByKey(key: string): Promise<void> {
        await db
            .delete(subtitleTimestampAdjustments)
            .where(eq(subtitleTimestampAdjustments.key, key));
    }

    public async deleteByFile(fileHash: string): Promise<void> {
        await db
            .delete(subtitleTimestampAdjustments)
            .where(
                eq(subtitleTimestampAdjustments.subtitle_hash, fileHash)
            );
    }

    public async getByKey(key: string): Promise<SubtitleTimestampAdjustment | undefined> {
        const values: SubtitleTimestampAdjustment[] = await db
            .select()
            .from(subtitleTimestampAdjustments)
            .where(eq(subtitleTimestampAdjustments.key, key))
            .limit(1);
        if (values.length === 0) {
            return undefined;
        }
        return values[0];
    }

    public getByPath(subtitlePath: string): Promise<SubtitleTimestampAdjustment[]> {
        return db
            .select()
            .from(subtitleTimestampAdjustments)
            .where(
                eq(subtitleTimestampAdjustments.subtitle_path, subtitlePath)
            );
    }

    public getByHash(h: string): Promise<SubtitleTimestampAdjustment[]> {
        return db
            .select()
            .from(subtitleTimestampAdjustments)
            .where(
                eq(subtitleTimestampAdjustments.subtitle_hash, h.toString())
            );
    }
}
