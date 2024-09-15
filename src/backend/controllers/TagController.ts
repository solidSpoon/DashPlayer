import ControllerT from '@/backend/interfaces/controllerT';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import { TagService } from '@/backend/services/TagService';
import registerRoute from '@/common/api/register';
import { Tag } from '@/backend/db/tables/tag';

@injectable()
export default class TagController implements ControllerT {
    @inject(TYPES.TagService) private tagService: TagService;
    public async addTag({ name }: { name: string }) {
        return this.tagService.addTag(name);
    }

    public async deleteTag({ id }: { id: number }) {
        return this.tagService.deleteTag(id);
    }

    public async updateTag({ id, name }: { id: number, name: string }) {
        return this.tagService.updateTag(id, name);
    }

    public async search({ keyword }: { keyword: string }): Promise<Tag[]> {
        return this.tagService.search(keyword);
    }

    registerRoutes(): void {
        registerRoute('tag/add', this.addTag.bind(this));
        registerRoute('tag/delete', this.deleteTag.bind(this));
        registerRoute('tag/update', this.updateTag.bind(this));
        registerRoute('tag/search', this.search.bind(this));
    }

}
