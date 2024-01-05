import { p } from '../../common/utils/Util';
import { InsertWord, words } from '../../db/tables/words';
import db from '../../db/db';
import natural from 'natural';
import {
    InsertSubtitleTimestampAdjustment,
    SubtitleTimestampAdjustment,
    subtitleTimestampAdjustments
} from '../../db/tables/subtitleTimestampAdjustment';
import { eq } from 'drizzle-orm';

export default class SubtitleTimestampAdjustmentService {
    public static async record(e: InsertSubtitleTimestampAdjustment): Promise<void> {
        await db.insert(subtitleTimestampAdjustments).values(e).onConflictDoUpdate({
            target: subtitleTimestampAdjustments.key,
            set: {
                subtitle_path: e.subtitle_path,
                start_at: e.start_at,
                end_at: e.end_at,
                updated_at: new Date().toISOString()
            }
        });
    }

    public static async deleteByKey(key: string): Promise<void> {
        await db.delete(subtitleTimestampAdjustments).where(eq(subtitleTimestampAdjustments.key, key));
    }

    public static async deleteByPath(subtitlePath: string): Promise<void> {
        await db.delete(subtitleTimestampAdjustments).where(eq(subtitleTimestampAdjustments.subtitle_path, subtitlePath));
    }

    public static async getByKey(key: string): Promise<SubtitleTimestampAdjustment | undefined> {
        let values: SubtitleTimestampAdjustment[] = await db.select().from(subtitleTimestampAdjustments).where(eq(subtitleTimestampAdjustments.key, key)).limit(1);
        if (values.length === 0) {
            return undefined;
        }
        return values[0];
    }

}



























