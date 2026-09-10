import { getMainLogger } from '@/backend/infrastructure/logger';
import db from '@/backend/infrastructure/db';
import { storeDelete, storeGetPersisted, storeHas, storeSet } from '@/backend/infrastructure/settings/store';

import { MigrationRunError, type CustomMigration, type CustomMigrationContext } from './types';
import { isCustomMigrationCompleted, markCustomMigrationCompleted } from './sysConfMarker';
import { storeSchemaProviderMigrationV1 } from './migrations/storeSchemaProviderMigrationV1';
import { transcriptionEngineSherpaDefaultMigrationV1 } from './migrations/transcriptionEngineSherpaDefaultMigrationV1';
import { storeSchemaDictionaryYoudaoMigrationV2 } from './migrations/storeSchemaDictionaryYoudaoMigrationV2';

const logger = getMainLogger('custom-migrations');

/**
 * 迁移账本：按数组顺序依次执行。
 *
 * 新迁移只能追加到末尾，不得插入或重排——已发布的安装可能停在账本中任意位置，
 * 顺序就是「这个安装的数据处于哪个阶段」的唯一事实。
 */
const customMigrations: CustomMigration[] = [
    storeSchemaProviderMigrationV1,
    transcriptionEngineSherpaDefaultMigrationV1,
    storeSchemaDictionaryYoudaoMigrationV2,
];

/**
 * 依次执行未完成的自定义迁移。
 *
 * 框架约定：
 * - 幂等可重入：完成标记只在 run() 完整成功后落库，任意一步失败后整个 run()
 *   会在下次启动重跑，因此迁移必须写成「重跑收敛」——条件写、重复执行无害。
 * - 配置存储读写只走 ctx.settings（store.ts 单例通道），禁止自建 electron-store
 *   实例；跨实例的内存快照看不到其他迁移的写入。
 * - 失败即停：某个迁移失败后不再执行账本中剩余的迁移，错误上抛中止启动，
 *   下次启动从未完成的迁移重试；带病执行后续迁移可能放大损坏面。
 */
const runCustomMigrations = async (): Promise<void> => {
    for (const [index, migration] of customMigrations.entries()) {
        if (await isCustomMigrationCompleted(migration.id)) {
            logger.debug('skip completed custom migration', { id: migration.id });
            continue;
        }

        logger.info('run custom migration', {
            id: migration.id,
            description: migration.description,
        });
        const ctx: CustomMigrationContext = {
            settings: {
                getPersisted: storeGetPersisted,
                hasPersisted: storeHas,
                set: storeSet,
                delete: storeDelete,
            },
            db,
            logger: getMainLogger(`custom-migration.${migration.id}`),
        };
        try {
            await migration.run(ctx);
        } catch (error) {
            logger.error('custom migration failed, stopping remaining migrations', {
                id: migration.id,
                remaining: customMigrations.length - index - 1,
                error,
            });
            // 包装失败身份后上抛：启动流程据此进入恢复模式（gate 页），marker 不落库。
            throw new MigrationRunError(migration.id, migration.description, error);
        }
        await markCustomMigrationCompleted(migration.id);
        logger.info('custom migration done', { id: migration.id });
    }
};

export default runCustomMigrations;
