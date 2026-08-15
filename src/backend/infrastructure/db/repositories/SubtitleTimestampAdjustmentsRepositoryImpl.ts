import { eq } from 'drizzle-orm';
import { injectable } from 'inversify';

import db from '@/backend/infrastructure/db';
import SubtitleTimestampAdjustmentsRepository from '@/backend/application/ports/repositories/SubtitleTimestampAdjustmentsRepository';
import {
    InsertSubtitleTimestampAdjustment,
    SubtitleTimestampAdjustmentRow,
    subtitleTimestampAdjustments,
} from '@/backend/infrastructure/db/tables/subtitleTimestampAdjustment';
import {
    SubtitleTimestampAdjustment,
    SubtitleTimestampAdjustmentInput,
} from '@/common/contracts/subtitle-timestamp-adjustment';
import TimeUtil from '@/common/utils/TimeUtil';

@injectable()
export default class SubtitleTimestampAdjustmentsRepositoryImpl implements SubtitleTimestampAdjustmentsRepository {
    /**
     * 新增或覆盖字幕时间调整记录。
     *
     * @param values 业务层提交的调整字段。
     */
    public async upsert(values: SubtitleTimestampAdjustmentInput): Promise<void> {
        await db
            .insert(subtitleTimestampAdjustments)
            .values(values satisfies InsertSubtitleTimestampAdjustment)
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
        const values: SubtitleTimestampAdjustmentRow[] = await db
            .select()
            .from(subtitleTimestampAdjustments)
            .where(eq(subtitleTimestampAdjustments.key, key))
            .limit(1);
        return values[0];
    }

    public async findByPath(subtitlePath: string): Promise<SubtitleTimestampAdjustment[]> {
        const values: SubtitleTimestampAdjustmentRow[] = await db
            .select()
            .from(subtitleTimestampAdjustments)
            .where(eq(subtitleTimestampAdjustments.subtitle_path, subtitlePath));
        return values;
    }

    public async findByHash(hash: string): Promise<SubtitleTimestampAdjustment[]> {
        const values: SubtitleTimestampAdjustmentRow[] = await db
            .select()
            .from(subtitleTimestampAdjustments)
            .where(eq(subtitleTimestampAdjustments.subtitle_hash, hash));
        return values;
    }
}
