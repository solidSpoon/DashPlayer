import { describe, it, expect, vi, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createMemoryDb, type MemoryDb } from '@/test/database';
import { wordTranslates } from '@/backend/infrastructure/db/tables/wordTranslates';
import type { MainLogger } from '@/backend/infrastructure/logger';
import type { CustomMigrationContext } from '../../types';
import { storeSchemaDictionaryYoudaoMigrationV2 } from '../storeSchemaDictionaryYoudaoMigrationV2';

/** 日志在单测里只需可调用；用空实现桩掉，避免拉起真实 logger 的 Electron 依赖。 */
const stubLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
} as unknown as MainLogger;

/**
 * 模拟迁移的配置存储通道：内存记录模拟 config.json 的持久化键值，
 * set/delete 直接改记录，从而能断言多次执行之间的收敛行为。
 */
function buildSettingsStub(persisted: Record<string, string>) {
    const sets: Array<{ key: string, value: string }> = [];
    const deletes: string[] = [];
    return {
        sets,
        deletes,
        settings: {
            getPersisted: (key: string): string | null => persisted[key] ?? null,
            hasPersisted: (key: string): boolean => key in persisted,
            set: (key: string, value: string | null | undefined): boolean => {
                if (value === null || value === undefined) {
                    delete persisted[key];
                } else {
                    persisted[key] = value;
                    sets.push({ key, value });
                }
                return true;
            },
            delete: (key: string): void => {
                delete persisted[key];
                deletes.push(key);
            },
        },
    };
}

/** 用内存库 + 桩配置通道组装迁移上下文。 */
async function buildContext(persisted: Record<string, string>): Promise<{ ctx: CustomMigrationContext, memoryDb: MemoryDb, sets: Array<{ key: string, value: string }>, deletes: string[] }> {
    const memoryDb = createMemoryDb();
    const stub = buildSettingsStub(persisted);
    return {
        memoryDb,
        sets: stub.sets,
        deletes: stub.deletes,
        ctx: {
            settings: stub.settings,
            db: memoryDb.db,
            logger: stubLogger,
        },
    };
}

/** 预置一条指定来源的词典缓存行。 */
const insertCacheRow = (db: MemoryDb['db'], word: string, provider: string) =>
    db.insert(wordTranslates).values({ word, provider, translate: JSON.stringify({ word, definitions: [] }) });

describe('storeSchemaDictionaryYoudaoMigrationV2 迁移', () => {
    let memoryDb: MemoryDb | null = null;

    afterEach(() => {
        memoryDb?.close();
        memoryDb = null;
    });

    it('词典引擎为 youdao 时切换为 openai，并清理凭据键与 youdao 缓存行', async () => {
        const built = await buildContext({
            'providers.dictionary': 'youdao',
            'apiKeys.youdao.secretId': 'sid',
            'apiKeys.youdao.secretKey': 'skey',
        });
        memoryDb = built.memoryDb;
        await insertCacheRow(built.memoryDb.db, 'hello', 'youdao');
        await insertCacheRow(built.memoryDb.db, 'world', 'openai');

        await storeSchemaDictionaryYoudaoMigrationV2.run(built.ctx);

        expect(built.sets).toContainEqual({ key: 'providers.dictionary', value: 'openai' });
        expect(built.deletes).toEqual(['apiKeys.youdao.secretId', 'apiKeys.youdao.secretKey']);
        const remaining = await built.memoryDb.db.select().from(wordTranslates);
        expect(remaining.map((row) => row.provider)).toEqual(['openai']);
    });

    it('配置里没有 youdao 时不改写引擎，但凭据键与缓存行仍被清理', async () => {
        const built = await buildContext({ 'providers.dictionary': 'openai' });
        memoryDb = built.memoryDb;
        await insertCacheRow(built.memoryDb.db, 'hello', 'youdao');

        await storeSchemaDictionaryYoudaoMigrationV2.run(built.ctx);

        expect(built.sets).toEqual([]);
        expect(built.deletes).toEqual(['apiKeys.youdao.secretId', 'apiKeys.youdao.secretKey']);
        const remaining = await built.memoryDb.db.select().from(wordTranslates);
        expect(remaining).toEqual([]);
    });

    it('重跑收敛：连续执行两次后配置与数据库状态一致，不再产生新写入', async () => {
        const persisted = {
            'providers.dictionary': 'youdao',
            'apiKeys.youdao.secretId': 'sid',
        };
        const built = await buildContext(persisted);
        memoryDb = built.memoryDb;
        await insertCacheRow(built.memoryDb.db, 'hello', 'youdao');

        await storeSchemaDictionaryYoudaoMigrationV2.run(built.ctx);
        await storeSchemaDictionaryYoudaoMigrationV2.run(built.ctx);

        // 第二次执行时引擎已是 openai，不再产生写入；凭据键已删，重复删除无害
        expect(built.sets).toEqual([{ key: 'providers.dictionary', value: 'openai' }]);
        expect(new Set(built.deletes)).toEqual(new Set(['apiKeys.youdao.secretId', 'apiKeys.youdao.secretKey']));
        expect(persisted['providers.dictionary']).toBe('openai');
        expect(persisted['apiKeys.youdao.secretId']).toBeUndefined();
        const remaining = await built.memoryDb.db.select().from(wordTranslates).where(eq(wordTranslates.provider, 'youdao'));
        expect(remaining).toEqual([]);
    });
});
