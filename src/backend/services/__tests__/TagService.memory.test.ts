import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { tag } from '@/backend/infrastructure/db/tables/tag';
import FavouriteClipsRepositoryImpl from '@/backend/infrastructure/db/repositories/FavouriteClipsRepositoryImpl';
import { TagServiceImpl } from '../TagService';
import { createMemoryDb, type MemoryDb } from '@/test/database';

/**
 * 标签服务与真实数据库 schema 的集成场景测试。
 *
 * 与 TagService.test.ts 的区别：这里绕过服务接口，直接操作表预置
 * "用户历史数据"，验证服务行为与已有数据叠加时的真实表现。
 */
describe('标签服务在内存数据库中的真实场景', () => {
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

    it('可以先预置数据，再新增标签，然后按前缀查询到全部标签', async () => {
        // 预置一条历史标签，模拟用户已有数据。
        memoryDb.db.insert(tag).values({ name: 'javascript' }).run();

        // 通过新增接口写入一条新标签。
        await tagService.addTag('java');

        // 通过查询接口按前缀搜索，应同时命中预置标签和新增标签。
        const result = await tagService.search('java');

        expect(result.map((item) => item.name).sort()).toEqual(['java', 'javascript']);
    });
});
