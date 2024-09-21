import { tag, Tag } from '@/backend/db/tables/tag';
import { injectable } from 'inversify';
import db from '@/backend/db';
import { eq, like } from 'drizzle-orm';
import StrUtil from '@/common/utils/str-util';

export interface TagService {
    addTag(name: string): Promise<Tag>;

    deleteTag(id: number): Promise<void>;

    updateTag(id: number, name: string): Promise<void>;

    search(keyword: string): Promise<Tag[]>;
}

@injectable()
export default class TagServiceImpl implements TagService {
    public async addTag(name: string): Promise<Tag> {
        if (StrUtil.isBlank(name)) {
            throw new Error('name is blank');
        }
        const e: Tag[] = await db.insert(tag).values({ name })
            .onConflictDoNothing()
            .returning();
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
