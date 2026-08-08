import { eq } from 'drizzle-orm';
import { injectable } from 'inversify';

import db from '@/backend/infrastructure/db';
import { watchHistoryExt } from '@/backend/infrastructure/db/tables/watchHistoryExt';
import WatchHistoryExtRepository, { WatchHistoryExtPatch, WatchHistoryExtRecord } from '@/backend/application/ports/repositories/WatchHistoryExtRepository';

@injectable()
export default class WatchHistoryExtRepositoryImpl implements WatchHistoryExtRepository {
    public async findByWatchHistoryId(watchHistoryId: string): Promise<WatchHistoryExtRecord | null> {
        const rows = await db
            .select()
            .from(watchHistoryExt)
            .where(eq(watchHistoryExt.watch_history_id, watchHistoryId))
            .limit(1);
        const row = rows[0];
        return row
            ? {
                podcast_mode_user_set: row.podcast_mode_user_set,
                podcast_mode_manual: row.podcast_mode_manual,
            }
            : null;
    }

    public async upsert(watchHistoryId: string, patch: WatchHistoryExtPatch): Promise<WatchHistoryExtRecord> {
        const rows = await db
            .insert(watchHistoryExt)
            .values({ watch_history_id: watchHistoryId, ...patch })
            .onConflictDoUpdate({
                target: watchHistoryExt.watch_history_id,
                set: patch,
            })
            .returning();
        const row = rows[0];
        if (!row) {
            throw new Error('upsert watch history ext failed');
        }
        return {
            podcast_mode_user_set: row.podcast_mode_user_set,
            podcast_mode_manual: row.podcast_mode_manual,
        };
    }

    public async deleteByWatchHistoryId(watchHistoryId: string): Promise<void> {
        await db
            .delete(watchHistoryExt)
            .where(eq(watchHistoryExt.watch_history_id, watchHistoryId));
    }
}
