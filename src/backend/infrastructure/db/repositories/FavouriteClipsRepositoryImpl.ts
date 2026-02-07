import { and, count, desc, eq, gte, inArray, isNull, like, lte, or, sql } from 'drizzle-orm';
import { injectable } from 'inversify';

import db from '@/backend/infrastructure/db';
import { clipTagRelation } from '@/backend/infrastructure/db/tables/clipTagRelation';
import { InsertTag, Tag, tag } from '@/backend/infrastructure/db/tables/tag';
import {InsertVideoClip, VideoClip, videoClip} from '@/backend/infrastructure/db/tables/videoClip';
import { ClipQuery } from '@/common/api/dto';
import TimeUtil from '@/common/utils/TimeUtil';

import FavouriteClipsRepository, { FavouriteClipsUpsertClipParams } from '@/backend/application/ports/repositories/FavouriteClipsRepository';

@injectable()
export default class FavouriteClipsRepositoryImpl implements FavouriteClipsRepository {

    public async listExistingClipKeys(keys: string[]): Promise<string[]> {
        if (keys.length === 0) {
            return [];
        }
        const rows: { key: string }[] = await db
            .select({ key: videoClip.key })
            .from(videoClip)
            .where(inArray(videoClip.key, keys));
        return rows.map((r) => r.key);
    }

    public async existsClipKey(key: string): Promise<boolean> {
        const rows: { key: string }[] = await db
            .select({ key: videoClip.key })
            .from(videoClip)
            .where(eq(videoClip.key, key));
        return rows.length > 0;
    }

    public async upsertClip(values: FavouriteClipsUpsertClipParams): Promise<void> {
        await db
            .insert(videoClip)
            .values({
                ...values,
                created_at: values.created_at ?? TimeUtil.timeUtc(),
                updated_at: values.updated_at ?? TimeUtil.timeUtc(),
            } satisfies InsertVideoClip)
            .onConflictDoUpdate({
                target: [videoClip.key],
                set: {
                    video_name: values.video_name,
                    srt_clip: values.srt_clip,
                    srt_context: values.srt_context,
                    updated_at: values.updated_at ?? TimeUtil.timeUtc(),
                },
            });
    }

    /**
     * 删除指定片段，并清理不再被任何片段引用的标签。
     *
     * 注意：better-sqlite3 使用同步事务，事务回调不可返回 Promise。
     * @param clipKey 片段 key。
     */
    public async deleteClipAndPruneTags(clipKey: string): Promise<void> {
        await db.transaction((tx) => {
            const tagIds: { tag_id: number | null }[] = tx
                .select({ tag_id: clipTagRelation.tag_id })
                .from(clipTagRelation)
                .where(eq(clipTagRelation.clip_key, clipKey));

            tx.delete(clipTagRelation).where(eq(clipTagRelation.clip_key, clipKey));
            tx.delete(videoClip).where(eq(videoClip.key, clipKey));

            for (const { tag_id } of tagIds) {
                if (!tag_id) {
                    continue;
                }
                const r = tx
                    .select({ c: count() })
                    .from(clipTagRelation)
                    .where(eq(clipTagRelation.tag_id, tag_id));
                if ((r[0]?.c ?? 0) === 0) {
                    tx.delete(tag).where(eq(tag.id, tag_id));
                }
            }
        });
    }

    /**
     * 清空收藏相关表数据。
     *
     * 注意：better-sqlite3 使用同步事务，事务回调不可返回 Promise。
     */
    public async deleteAll(): Promise<void> {
        await db.transaction((tx) => {
            tx.delete(videoClip).where(sql`1=1`);
            tx.delete(clipTagRelation).where(sql`1=1`);
            tx.delete(tag).where(sql`1=1`);
        });
    }

    public async searchClipKeys(query?: ClipQuery): Promise<string[]> {
        const keyword = query?.keyword ?? '';
        const keywordRange = query?.keywordRange ?? 'clip';
        const tags = query?.tags ?? [];
        const tagsRelation = query?.tagsRelation ?? 'and';
        const date = query?.date;
        const includeNoTag = query?.includeNoTag ?? false;

        let where1 = and(sql`1=1`);
        let having1 = and(sql`1=1`);
        if (keyword) {
            if (keywordRange === 'context') {
                where1 = and(like(videoClip.srt_context, `%${keyword}%`));
            } else {
                where1 = and(like(videoClip.srt_clip, `%${keyword}%`));
            }
        }
        if (date?.from) {
            where1 = and(where1, gte(videoClip.created_at, TimeUtil.dateToUtc(date.from)));
        }
        if (date?.to) {
            where1 = and(where1, lte(videoClip.created_at, TimeUtil.dateToUtc(date.to)));
        }
        if (tags.length) {
            where1 = and(where1, inArray(clipTagRelation.tag_id, tags));
            if (tagsRelation === 'and') {
                having1 = and(having1, eq(count(), tags.length));
            }
        }
        if (includeNoTag) {
            if (tagsRelation === 'or' && tags.length) {
                having1 = or(having1, isNull(clipTagRelation.tag_id));
            } else {
                where1 = and(where1, isNull(clipTagRelation.tag_id));
            }
        }

        const rows: { key: string }[] = await db
            .select({
                key: videoClip.key,
            })
            .from(videoClip)
            .leftJoin(clipTagRelation, eq(clipTagRelation.clip_key, videoClip.key))
            .leftJoin(tag, eq(clipTagRelation.tag_id, tag.id))
            .where(where1)
            .groupBy(videoClip.key)
            .having(having1)
            .orderBy(desc(videoClip.created_at))
            .limit(5000);

        return rows.map((r) => r.key);
    }

    public async listTagsByClipKey(clipKey: string): Promise<Tag[]> {
        const rows: { dp_tag: Tag | null }[] = await db
            .select()
            .from(clipTagRelation)
            .leftJoin(tag, eq(clipTagRelation.tag_id, tag.id))
            .where(eq(clipTagRelation.clip_key, clipKey));
        return rows
            .map((item) => item.dp_tag)
            .filter((item): item is Tag => item !== null);
    }

    public async ensureTag(name: string): Promise<Tag> {
        const e: Tag[] = await db
            .insert(tag)
            .values({ name } satisfies InsertTag)
            .onConflictDoUpdate({
                target: [tag.name],
                set: { name },
            })
            .returning();
        const row = e[0];
        if (!row) {
            throw new Error('ensureTag failed');
        }
        return row;
    }

    public async deleteTagById(tagId: number): Promise<void> {
        await db.delete(tag).where(eq(tag.id, tagId));
    }

    public async updateTagName(tagId: number, name: string): Promise<void> {
        await db.update(tag).set({ name }).where(eq(tag.id, tagId));
    }

    public async searchTagsByPrefix(keyword: string): Promise<Tag[]> {
        return db
            .select()
            .from(tag)
            .where(like(tag.name, `${keyword}%`));
    }

    public async insertClipTagIgnore(clipKey: string, tagId: number): Promise<void> {
        await db
            .insert(clipTagRelation)
            .values({
                clip_key: clipKey,
                tag_id: tagId,
                created_at: TimeUtil.timeUtc(),
                updated_at: TimeUtil.timeUtc(),
            })
            .onConflictDoNothing();
    }

    /**
     * 删除片段与标签关系，并在标签无引用时回收标签。
     *
     * 注意：better-sqlite3 使用同步事务，事务回调不可返回 Promise。
     * @param clipKey 片段 key。
     * @param tagId 标签 id。
     */
    public async deleteClipTagAndPruneTag(clipKey: string, tagId: number): Promise<void> {
        await db.transaction((tx) => {
            tx.delete(clipTagRelation).where(
                and(
                    eq(clipTagRelation.clip_key, clipKey),
                    eq(clipTagRelation.tag_id, tagId),
                ),
            );
            const r = tx
                .select({ c: count() })
                .from(clipTagRelation)
                .where(eq(clipTagRelation.tag_id, tagId));
            if ((r[0]?.c ?? 0) === 0) {
                tx.delete(tag).where(eq(tag.id, tagId));
            }
        });
    }

    public async listClipKeysByTagId(tagId: number): Promise<string[]> {
        const rows: { dp_video_clip: Pick<VideoClip, 'key'> | null }[] = await db
            .select({
                dp_video_clip: {
                    key: videoClip.key,
                },
            })
            .from(clipTagRelation)
            .leftJoin(videoClip, eq(clipTagRelation.clip_key, videoClip.key))
            .where(eq(clipTagRelation.tag_id, tagId));
        return rows
            .map((r) => r.dp_video_clip?.key ?? null)
            .filter((k): k is string => k !== null);
    }
}
