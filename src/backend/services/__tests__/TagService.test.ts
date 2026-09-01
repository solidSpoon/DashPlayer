import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import FavouriteClipsRepositoryImpl from '@/backend/infrastructure/db/repositories/FavouriteClipsRepositoryImpl';
import { createMemoryDb, type MemoryDb } from '@/test/database';
import { TagServiceImpl } from '../TagService';

/**
 * 标签服务的内存数据库行为测试。
 *
 * 不 mock 仓储层，直接用真实 SQLite 内存库验证服务的可观测行为：
 * 入库结果、查询结果和错误抛出，而不是断言内部方法调用。
 */
describe('标签服务', () => {
    let memoryDb: MemoryDb;
    let tagService: TagServiceImpl;

    beforeEach(() => {
        memoryDb = createMemoryDb();
        const repository = new FavouriteClipsRepositoryImpl(memoryDb.db);
        tagService = new TagServiceImpl(repository);
    });

    afterEach(() => {
        memoryDb.close();
    });

    describe('添加标签', () => {
        it('可以成功添加新标签', async () => {
            const result = await tagService.addTag('test-tag');

            expect(result.name).toBe('test-tag');
            expect(result.id).toBeGreaterThan(0);
        });

        it('标签名称为空白时会抛出错误', async () => {
            await expect(tagService.addTag('')).rejects.toThrow('name is blank');
            await expect(tagService.addTag('   ')).rejects.toThrow('name is blank');
        });

        it('重复添加同名标签时返回原标签', async () => {
            const first = await tagService.addTag('existing-tag');
            const second = await tagService.addTag('existing-tag');

            expect(second.id).toBe(first.id);
            expect(second.name).toBe('existing-tag');
        });
    });

    describe('删除标签', () => {
        it('可以删除已存在的标签', async () => {
            const created = await tagService.addTag('to-delete');

            await tagService.deleteTag(created.id);

            const remaining = await tagService.search('to-delete');
            expect(remaining).toEqual([]);
        });

        it('删除不存在的标签时正常结束不报错', async () => {
            await expect(tagService.deleteTag(999)).resolves.toBeUndefined();
        });
    });

    describe('修改标签', () => {
        it('可以修改标签名称', async () => {
            const created = await tagService.addTag('old-name');

            await tagService.updateTag(created.id, 'new-name');

            const oldResult = await tagService.search('old-name');
            const newResult = await tagService.search('new-name');
            expect(oldResult).toEqual([]);
            expect(newResult.map((item) => item.name)).toEqual(['new-name']);
        });
    });

    describe('搜索标签', () => {
        it('可以按前缀搜索到匹配的标签', async () => {
            await tagService.addTag('javascript');
            await tagService.addTag('java');
            await tagService.addTag('python');

            const result = await tagService.search('java');

            expect(result.map((item) => item.name).sort()).toEqual(['java', 'javascript']);
        });

        it('没有匹配标签时返回空数组', async () => {
            await tagService.addTag('javascript');

            const result = await tagService.search('python');

            expect(result).toEqual([]);
        });

        it('空关键字可以搜到全部标签', async () => {
            await tagService.addTag('javascript');
            await tagService.addTag('python');

            const result = await tagService.search('');

            expect(result.map((item) => item.name).sort()).toEqual(['javascript', 'python']);
        });
    });
});
