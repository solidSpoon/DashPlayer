import { Tag } from '@/backend/db/tables/tag';

export default interface TagService {
    addTag(name: string): Promise<Tag>;

    deleteTag(id: number): Promise<void>;

    updateTag(id: number, name: string): Promise<void>;

    search(keyword: string): Promise<Tag[]>;
}
