import { and, count, desc, eq, gte, inArray, isNull, like, lte, or, sql } from 'drizzle-orm';
import { inject, injectable } from 'inversify';

import TYPES from '@/backend/ioc/types';
import type { Db } from '@/backend/infrastructure/db/createDb';
import { clipTagRelation } from '@/backend/infrastructure/db/tables/clipTagRelation';
import { InsertTag, TagRow, tag } from '@/backend/infrastructure/db/tables/tag';
import { Tag } from '@/common/contracts/tag';
import {InsertVideoClip, VideoClip, videoClip} from '@/backend/infrastructure/db/tables/videoClip';
import { ClipQuery } from '@/common/api/dto';
import TimeUtil from '@/common/utils/TimeUtil';

import FavouriteClipsRepository, { FavouriteClipsReplaceAllItem, FavouriteClipsUpsertClipParams } from '@/backend/application/ports/repositories/FavouriteClipsRepository';

@injectable()
export default class FavouriteClipsRepositoryImpl implements FavouriteClipsRepository {
    /**
     * @param db 由依赖容器注入的 drizzle 实例；测试中可替换为内存库。
     */
    constructor(@inject(TYPES.Database) private readonly db: Db) {}

    public async listExistingClipKeys(keys: string[]): Promise<string[]> {
        if (keys.length === 0) {
            return [];
        }
        const rows: { key: string }[] = await this.db
            .select({ key: videoClip.key })
            .from(videoClip)
            .where(inArray(videoClip.key, keys));
        return rows.map((r) => r.key);
    }

    public async existsClipKey(key: string): Promise<boolean> {
        const rows: { key: string }[] = await this.db
            .select({ key: videoClip.key })
            .from(videoClip)
            .where(eq(videoClip.key, key));
        return rows.length > 0;
    }

    /**
     * 原子地保存一个片段及其标签关联。
     *
     * 行为说明：
     * - 片段按 key upsert，标签不存在时自动创建，关联按 clip_key+tag_id 去重；
     * - 整个写入在一个事务内完成，任一步失败都会整体回滚。
     *
     * @param values 片段内容。
     * @param tagNames 该片段关联的标签名列表。
     */
    public async saveClipWithTags(values: FavouriteClipsUpsertClipParams, tagNames: string[]): Promise<void> {
        this.db.transaction((tx) => {
            tx.insert(videoClip)
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
                })
                .run();

            for (const name of tagNames) {
                const created = tx
                    .insert(tag)
                    .values({ name } satisfies InsertTag)
                    .onConflictDoUpdate({
                        target: [tag.name],
                        set: { name },
                    })
                    .returning({ id: tag.id })
                    .get();
                if (!created) {
                    throw new Error('saveClipWithTags failed to ensure tag');
                }
                tx.insert(clipTagRelation)
                    .values({
                        clip_key: values.key,
                        tag_id: created.id,
                        created_at: TimeUtil.timeUtc(),
                        updated_at: TimeUtil.timeUtc(),
                    })
                    .onConflictDoNothing()
                    .run();
            }
        });
    }

    /**
     * 原子地清空收藏相关表并重灌一批片段及其标签。
     *
     * 行为说明：
     * - 先清空 videoClip / clipTagRelation / tag 三张表，再按传入列表逐条写入；
     * - 整个替换在一个事务内完成，任一步失败都会整体回滚，避免留下半成品数据。
     *
     * @param clips 重灌的片段列表，每项包含片段内容和关联标签名。
     */
    public async replaceAll(clips: FavouriteClipsReplaceAllItem[]): Promise<void> {
        this.db.transaction((tx) => {
            tx.delete(videoClip).where(sql`1=1`).run();
            tx.delete(clipTagRelation).where(sql`1=1`).run();
            tx.delete(tag).where(sql`1=1`).run();

            for (const { clip, tags } of clips) {
                tx.insert(videoClip)
                    .values({
                        ...clip,
                        created_at: clip.created_at ?? TimeUtil.timeUtc(),
                        updated_at: clip.updated_at ?? TimeUtil.timeUtc(),
                    } satisfies InsertVideoClip)
                    .onConflictDoUpdate({
                        target: [videoClip.key],
                        set: {
                            video_name: clip.video_name,
                            srt_clip: clip.srt_clip,
                            srt_context: clip.srt_context,
                            updated_at: clip.updated_at ?? TimeUtil.timeUtc(),
                        },
                    })
                    .run();

                for (const name of tags) {
                    const created = tx
                        .insert(tag)
                        .values({ name } satisfies InsertTag)
                        .onConflictDoUpdate({
                            target: [tag.name],
                            set: { name },
                        })
                        .returning({ id: tag.id })
                        .get();
                    if (!created) {
                        throw new Error('replaceAll failed to ensure tag');
                    }
                    tx.insert(clipTagRelation)
                        .values({
                            clip_key: clip.key,
                            tag_id: created.id,
                            created_at: TimeUtil.timeUtc(),
                            updated_at: TimeUtil.timeUtc(),
                        })
                        .onConflictDoNothing()
                        .run();
                }
            }
        });
    }

    /**
     * 删除指定片段，并清理不再被任何片段引用的标签。
     *
     * 注意：better-sqlite3 使用同步事务，事务回调不可返回 Promise。
     * @param clipKey 片段 key。
     */
    public async deleteClipAndPruneTags(clipKey: string): Promise<void> {
        await this.db.transaction((tx) => {
            const tagIds: { tag_id: number | null }[] = tx
                .select({ tag_id: clipTagRelation.tag_id })
                .from(clipTagRelation)
                .where(eq(clipTagRelation.clip_key, clipKey))
                .all();

            tx.delete(clipTagRelation).where(eq(clipTagRelation.clip_key, clipKey)).run();
            tx.delete(videoClip).where(eq(videoClip.key, clipKey)).run();

            for (const { tag_id } of tagIds) {
                if (!tag_id) {
                    continue;
                }
                const r = tx
                    .select({ c: count() })
                    .from(clipTagRelation)
                    .where(eq(clipTagRelation.tag_id, tag_id))
                    .all();
                if ((r[0]?.c ?? 0) === 0) {
                    tx.delete(tag).where(eq(tag.id, tag_id)).run();
                }
            }
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

        const rows: { key: string }[] = await this.db
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
        const rows: { dp_tag: TagRow | null }[] = await this.db
            .select()
            .from(clipTagRelation)
            .leftJoin(tag, eq(clipTagRelation.tag_id, tag.id))
            .where(eq(clipTagRelation.clip_key, clipKey));
        return rows
            .map((item) => item.dp_tag)
            .filter((item): item is Tag => item !== null);
    }

    public async ensureTag(name: string): Promise<Tag> {
        const e: TagRow[] = await this.db
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
        await this.db.delete(tag).where(eq(tag.id, tagId));
    }

    public async updateTagName(tagId: number, name: string): Promise<void> {
        await this.db.update(tag).set({ name }).where(eq(tag.id, tagId));
    }

    public async searchTagsByPrefix(keyword: string): Promise<Tag[]> {
        const rows: TagRow[] = await this.db
            .select()
            .from(tag)
            .where(like(tag.name, `${keyword}%`));
        return rows;
    }

    public async insertClipTagIgnore(clipKey: string, tagId: number): Promise<void> {
        await this.db
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
        await this.db.transaction((tx) => {
            tx.delete(clipTagRelation).where(
                and(
                    eq(clipTagRelation.clip_key, clipKey),
                    eq(clipTagRelation.tag_id, tagId),
                ),
            ).run();
            const r = tx
                .select({ c: count() })
                .from(clipTagRelation)
                .where(eq(clipTagRelation.tag_id, tagId))
                .all();
            if ((r[0]?.c ?? 0) === 0) {
                tx.delete(tag).where(eq(tag.id, tagId)).run();
            }
        });
    }

    public async listClipKeysByTagId(tagId: number): Promise<string[]> {
        const rows: { dp_video_clip: Pick<VideoClip, 'key'> | null }[] = await this.db
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
