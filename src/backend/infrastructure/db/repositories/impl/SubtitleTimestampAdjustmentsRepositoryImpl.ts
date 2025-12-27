import { eq } from 'drizzle-orm';
import { injectable } from 'inversify';

import db from '@/backend/infrastructure/db';
import SubtitleTimestampAdjustmentsRepository from '@/backend/infrastructure/db/repositories/SubtitleTimestampAdjustmentsRepository';
import {
    InsertSubtitleTimestampAdjustment,
    SubtitleTimestampAdjustment,
    subtitleTimestampAdjustments,
} from '@/backend/infrastructure/db/tables/subtitleTimestampAdjustment';
import TimeUtil from '@/common/utils/TimeUtil';

@injectable()
export default class SubtitleTimestampAdjustmentsRepositoryImpl implements SubtitleTimestampAdjustmentsRepository {
    public async upsert(values: InsertSubtitleTimestampAdjustment): Promise<void> {
        await db
            .insert(subtitleTimestampAdjustments)
            .values(values)
            .onConflictDoUpdate({
                target: subtitleTimestampAdjustments.key,
                set: {
                    subtitle_path: values.subtitle_path,
                    start_at: values.start_at,
                    end_at: values.end_at,
                    updated_at: TimeUtil.timeUtc(),
                },
            });
    }

    public async deleteByKey(key: string): Promise<void> {
        await db
            .delete(subtitleTimestampAdjustments)
            .where(eq(subtitleTimestampAdjustments.key, key));
    }

    public async deleteByFileHash(fileHash: string): Promise<void> {
        await db
            .delete(subtitleTimestampAdjustments)
            .where(eq(subtitleTimestampAdjustments.subtitle_hash, fileHash));
    }

    public async findByKey(key: string): Promise<SubtitleTimestampAdjustment | undefined> {
        const values: SubtitleTimestampAdjustment[] = await db
            .select()
            .from(subtitleTimestampAdjustments)
            .where(eq(subtitleTimestampAdjustments.key, key))
            .limit(1);
        return values[0];
    }

    public findByPath(subtitlePath: string): Promise<SubtitleTimestampAdjustment[]> {
        return db
            .select()
            .from(subtitleTimestampAdjustments)
            .where(eq(subtitleTimestampAdjustments.subtitle_path, subtitlePath));
    }

    public findByHash(hash: string): Promise<SubtitleTimestampAdjustment[]> {
        return db
            .select()
            .from(subtitleTimestampAdjustments)
            .where(eq(subtitleTimestampAdjustments.subtitle_hash, hash));
    }
}

