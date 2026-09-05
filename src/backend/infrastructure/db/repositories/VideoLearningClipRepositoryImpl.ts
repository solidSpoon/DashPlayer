import { desc, eq, inArray, sql } from 'drizzle-orm';
import { injectable } from 'inversify';

import db from '@/backend/infrastructure/db';
import { InsertVideoLearningClip, VideoLearningClip, videoLearningClip } from '@/backend/infrastructure/db/tables/videoLearningClip';
import { InsertVideoLearningClipWord, videoLearningClipWord } from '@/backend/infrastructure/db/tables/videoLearningClipWord';
import TimeUtil from '@/common/utils/TimeUtil';
import VideoLearningClipRepository, { VideoLearningClipCountQuery, VideoLearningClipPageQuery } from '@/backend/services/repositories/VideoLearningClipRepository';

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

    /**
     * 原子地保存一个视频学习片段及其单词关系。
     *
     * 行为说明：
     * - 片段按 key upsert，单词关系按唯一索引去重；
     * - 整个写入在一个事务内完成，任一步失败都会整体回滚。
     *
     * @param clip 片段内容。
     * @param words 该片段关联的单词关系列表。
     */
    public async saveClipWithWords(clip: InsertVideoLearningClip, words: InsertVideoLearningClipWord[]): Promise<void> {
        db.transaction((tx) => {
            const now = TimeUtil.timeUtc();
            tx.insert(videoLearningClip)
                .values({
                    ...clip,
                    created_at: clip.created_at ?? now,
                    updated_at: clip.updated_at ?? now,
                })
                .onConflictDoUpdate({
                    target: [videoLearningClip.key],
                    set: {
                        video_name: clip.video_name,
                        srt_clip: clip.srt_clip,
                        srt_context: clip.srt_context,
                        updated_at: clip.updated_at ?? now,
                    },
                })
                .run();

            if (words.length > 0) {
                tx.insert(videoLearningClipWord).values(words).onConflictDoNothing().run();
            }
        });
    }

    /**
     * 原子地删除一个片段及其全部单词关联。
     *
     * 行为说明：
     * - 片段记录与其单词关联在一个事务内删除，避免留下孤儿关联导致统计虚高。
     *
     * @param key 片段键。
     */
    public async deleteClipWithWords(key: string): Promise<void> {
        db.transaction((tx) => {
            tx.delete(videoLearningClipWord).where(eq(videoLearningClipWord.clip_key, key)).run();
            tx.delete(videoLearningClip).where(eq(videoLearningClip.key, key)).run();
        });
    }

    /**
     * 原子地清空视频学习片段与单词关系两张表，并重灌一批数据。
     *
     * 行为说明：
     * - 先清空 dp_video_learning_clip 与 dp_video_learning_clip_word，再按传入列表逐条写入；
     * - 整个替换在一个事务内完成，任一步失败都会整体回滚，避免片段与单词关系不一致。
     *
     * @param clips 重灌的片段列表。
     * @param words 重灌的片段-单词关系列表。
     */
    public async replaceAll(clips: InsertVideoLearningClip[], words: InsertVideoLearningClipWord[]): Promise<void> {
        db.transaction((tx) => {
            tx.delete(videoLearningClip).where(sql`1=1`).run();
            tx.delete(videoLearningClipWord).where(sql`1=1`).run();

            for (const values of clips) {
                const now = TimeUtil.timeUtc();
                tx.insert(videoLearningClip)
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
                    })
                    .run();
            }

            // 单词关系分块写入，避免单条 INSERT 超过 SQLite 变量数量上限
            // （每行 4 个字段，默认上限 32766，故每块不超过 8000 行）
            const WORD_CHUNK_SIZE = 8000;
            for (let i = 0; i < words.length; i += WORD_CHUNK_SIZE) {
                const chunk = words.slice(i, i + WORD_CHUNK_SIZE);
                tx.insert(videoLearningClipWord).values(chunk).onConflictDoNothing().run();
            }
        });
    }
}
