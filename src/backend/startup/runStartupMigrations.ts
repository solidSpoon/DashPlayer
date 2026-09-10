import runMigrate from '@/backend/infrastructure/db/migrate';
import { getMainLogger } from '@/backend/infrastructure/logger';

import runCustomMigrations from './customMigrations/runCustomMigrations';
import { MigrationRunError } from './customMigrations/types';
import { setMigrationFailure } from './migrationFailureState';

const logger = getMainLogger('startup-migrations');

/**
 * 执行启动期迁移：先 drizzle（SQLite schema），后自定义迁移（设置/数据语义）。
 *
 * 任一阶段失败：把失败信息写入进程内恢复状态（供 migration-failure/* 路由
 * 展示给用户），并把错误继续上抛——调用方（main）据此进入恢复模式，
 * 不执行任何业务初始化。
 */
const runStartupMigrations = async (): Promise<void> => {
    try {
        logger.info('running drizzle migrations');
        await runMigrate();
        logger.info('running custom migrations');
        await runCustomMigrations();
    } catch (error) {
        if (error instanceof MigrationRunError) {
            setMigrationFailure({
                phase: 'custom',
                migrationId: error.migrationId,
                description: error.migrationDescription,
                errorMessage: error.causeMessage,
            });
        } else {
            setMigrationFailure({
                phase: 'drizzle',
                migrationId: null,
                description: null,
                errorMessage: error instanceof Error ? error.message : String(error),
            });
        }
        throw error;
    }
};

export default runStartupMigrations;
