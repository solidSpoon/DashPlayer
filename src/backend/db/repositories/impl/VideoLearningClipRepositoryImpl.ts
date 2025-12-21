import { desc, eq, inArray, sql } from 'drizzle-orm';
import { injectable } from 'inversify';

import db from '@/backend/db';
import { InsertVideoLearningClip, VideoLearningClip, videoLearningClip } from '@/backend/db/tables/videoLearningClip';
import TimeUtil from '@/common/utils/TimeUtil';
import VideoLearningClipRepository, { VideoLearningClipCountQuery, VideoLearningClipPageQuery } from '@/backend/db/repositories/VideoLearningClipRepository';

@injectable()
export default class VideoLearningClipRepositoryImpl implements VideoLearningClipRepository {

    public async findExistingKeys(keys: string[]): Promise<Set<string>> {
        if (keys.length === 0) {
            return new Set();
        }

        const rows = await db
            .select({ key: videoLearningClip.key })
            .from(videoLearningClip)
            .where(inArray(videoLearningClip.key, keys));

        return new Set(rows.map((r) => r.key));
    }

    public async count(query: VideoLearningClipCountQuery = {}): Promise<number> {
        if (Array.isArray(query.keys) && query.keys.length === 0) {
            return 0;
        }

        const rows = await db
            .select({ count: sql<number>`count(*)` })
            .from(videoLearningClip)
            .where(query.keys ? inArray(videoLearningClip.key, query.keys) : undefined);

        return Number(rows?.[0]?.count ?? 0);
    }

    public async listPage(query: VideoLearningClipPageQuery): Promise<VideoLearningClip[]> {
        if (Array.isArray(query.keys) && query.keys.length === 0) {
            return [];
        }

        return db
            .select()
            .from(videoLearningClip)
            .where(query.keys ? inArray(videoLearningClip.key, query.keys) : undefined)
            .orderBy(desc(videoLearningClip.created_at))
            .offset(query.offset)
            .limit(query.limit);
    }

    public async exists(key: string): Promise<boolean> {
        const row = db
            .select({ key: videoLearningClip.key })
            .from(videoLearningClip)
            .where(eq(videoLearningClip.key, key))
            .get();
        return !!row;
    }

    public async upsert(values: InsertVideoLearningClip): Promise<void> {
        const now = TimeUtil.timeUtc();
        await db
            .insert(videoLearningClip)
            .values({
                ...values,
                created_at: values.created_at ?? now,
                updated_at: values.updated_at ?? now,
            })
            .onConflictDoUpdate({
                target: [videoLearningClip.key],
                set: {
                    video_name: values.video_name,
                    srt_clip: values.srt_clip,
                    srt_context: values.srt_context,
                    updated_at: values.updated_at ?? now,
                },
            });
    }

    public async deleteByKey(key: string): Promise<void> {
        await db.delete(videoLearningClip).where(eq(videoLearningClip.key, key));
    }

    public async deleteAll(): Promise<void> {
        await db.delete(videoLearningClip).where(sql`1=1`);
    }
}

