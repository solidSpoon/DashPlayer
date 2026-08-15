import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { tag } from '@/backend/infrastructure/db/tables/tag';
import FavouriteClipsRepositoryImpl from '@/backend/infrastructure/db/repositories/FavouriteClipsRepositoryImpl';
import { TagServiceImpl } from '../TagService';
import { createMemoryDb, type MemoryDb } from '@/test/database';

// 场景测试不依赖 inversify 容器，直接把真实仓储注入服务；
// 装饰器在这里只保留类型约束，实际装配由测试手动完成。
vi.mock('inversify', () => ({
    injectable: () => (target: unknown) => target,
    inject: () => (target: unknown, _propertyKey: string) => target,
}));

describe('标签服务在内存数据库中的真实场景', () => {
    let memoryDb: MemoryDb;
    let tagService: TagServiceImpl;

    beforeEach(() => {
        memoryDb = createMemoryDb();
        const repository = new FavouriteClipsRepositoryImpl(memoryDb.db);
        tagService = new TagServiceImpl();
        (tagService as unknown as { favouriteClipsRepository: FavouriteClipsRepositoryImpl }).favouriteClipsRepository = repository;
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
