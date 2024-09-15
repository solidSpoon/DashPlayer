import { tag, Tag } from '@/backend/db/tables/tag';
import { injectable } from 'inversify';
import db from '@/backend/db';
import { eq, ExtractTablesWithRelations, like } from 'drizzle-orm';
import { SQLiteTransaction } from 'drizzle-orm/sqlite-core/index';
import Database from 'better-sqlite3';
import { Transaction } from '@/backend/db/db';
import Util from '@/common/utils/Util';

export interface TagService {
    addTag(name: string): Promise<Tag>;

    deleteTag(id: number): Promise<void>;

    updateTag(id: number, name: string): Promise<void>;

    search(keyword: string): Promise<Tag[]>;
}

@injectable()
export default class TagServiceImpl implements TagService {
    public async addTag(name: string): Promise<Tag> {
        if (Util.strBlank(name)) {
            throw new Error('name is blank');
        }
        const e: Tag[] = await db.insert(tag).values({ name }).returning();
        return e[0];
    }

    public async deleteTag(id: number): Promise<void> {
        await db.delete(tag).where(eq(tag.id, id));
    }

    public async updateTag(id: number, name: string): Promise<void> {
        await db.update(tag).set({ name }).where(eq(tag.id, id));
    }

    public async search(keyword: string): Promise<Tag[]> {
        return db.select().from(tag)
            .where(like(tag.name, `${keyword}%`));
    }
}
