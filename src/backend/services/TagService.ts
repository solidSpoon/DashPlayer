import { inject, injectable } from 'inversify';

import FavouriteClipsRepository from '@/backend/services/repositories/FavouriteClipsRepository';
import TYPES from '@/backend/ioc/types';
import type { Tag } from '@/common/contracts/tag';
import StrUtil from '@/common/utils/str-util';/**
 * TagService 的业务契约。
 */
export default interface TagService {
    /**
     * 创建标签，已存在的标签由仓储返回原记录。
     *
     * @param name 标签名称，不能为空白字符串。
     * @returns 新建或已存在的标签。
     */
    addTag(name: string): Promise<Tag>;

    /**
     * 删除指定标签。
     *
     * @param id 标签主键。
     */
    deleteTag(id: number): Promise<void>;

    /**
     * 修改指定标签的名称。
     *
     * @param id 标签主键。
     * @param name 新标签名称。
     */
    updateTag(id: number, name: string): Promise<void>;

    /**
     * 按名称前缀搜索标签。
     *
     * @param keyword 搜索关键字，空字符串交由仓储处理。
     * @returns 匹配的标签列表。
     */
    search(keyword: string): Promise<Tag[]>;
}



/**
 * 管理收藏片段使用的标签。
 */
@injectable()
export class TagServiceImpl implements TagService {
    @inject(TYPES.FavouriteClipsRepository)
    private favouriteClipsRepository!: FavouriteClipsRepository;

    /**
     * 创建标签，已存在的标签由仓储返回原记录。
     *
     * @param name 标签名称，不能为空白字符串。
     * @returns 新建或已存在的标签。
     */
    public async addTag(name: string): Promise<Tag> {
        if (StrUtil.isBlank(name)) {
            throw new Error('name is blank');
        }
        return this.favouriteClipsRepository.ensureTag(name);
    }

    /**
     * 删除指定标签。
     *
     * @param id 标签主键。
     */
    public async deleteTag(id: number): Promise<void> {
        await this.favouriteClipsRepository.deleteTagById(id);
    }

    /**
     * 修改指定标签的名称。
     *
     * @param id 标签主键。
     * @param name 新标签名称。
     */
    public async updateTag(id: number, name: string): Promise<void> {
        await this.favouriteClipsRepository.updateTagName(id, name);
    }

    /**
     * 按名称前缀搜索标签。
     *
     * @param keyword 搜索关键字，空字符串交由仓储处理。
     * @returns 匹配的标签列表。
     */
    public async search(keyword: string): Promise<Tag[]> {
        return this.favouriteClipsRepository.searchTagsByPrefix(keyword);
    }
}
