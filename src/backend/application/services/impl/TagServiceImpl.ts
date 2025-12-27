import { inject, injectable } from 'inversify';
import StrUtil from '@/common/utils/str-util';
import TagService from '@/backend/application/services/TagService';
import TYPES from '@/backend/ioc/types';
import { Tag } from '@/backend/infrastructure/db/tables/tag';
import FavouriteClipsRepository from '@/backend/infrastructure/db/repositories/FavouriteClipsRepository';


@injectable()
export default class TagServiceImpl implements TagService {
    @inject(TYPES.FavouriteClipsRepository)
    private favouriteClipsRepository!: FavouriteClipsRepository;

    public async addTag(name: string): Promise<Tag> {
        if (StrUtil.isBlank(name)) {
            throw new Error('name is blank');
        }
        return this.favouriteClipsRepository.ensureTag(name);
    }

    public async deleteTag(id: number): Promise<void> {
        await this.favouriteClipsRepository.deleteTagById(id);
    }

    public async updateTag(id: number, name: string): Promise<void> {
        await this.favouriteClipsRepository.updateTagName(id, name);
    }

    public async search(keyword: string): Promise<Tag[]> {
        return this.favouriteClipsRepository.searchTagsByPrefix(keyword);
    }
}
