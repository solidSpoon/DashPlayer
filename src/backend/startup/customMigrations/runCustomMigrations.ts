import { getMainLogger } from '@/backend/infrastructure/logger';
import { isDevelopmentMode } from '@/backend/utils/runtimeEnv';

import type { CustomMigration } from './types';
import { isCustomMigrationCompleted, markCustomMigrationCompleted } from './sysConfMarker';
import { storeSchemaProviderMigrationV1 } from './migrations/storeSchemaProviderMigrationV1';

const logger = getMainLogger('custom-migrations');

const customMigrations: CustomMigration[] = [
    storeSchemaProviderMigrationV1,
];

const runCustomMigrations = async (): Promise<void> => {
    for (const migration of customMigrations) {
        const completed = await isCustomMigrationCompleted(migration.id);
        if (completed) {
            logger.debug('skip completed custom migration', { id: migration.id });
            continue;
        }

        logger.info('run custom migration', {
            id: migration.id,
            description: migration.description,
        });

        try {
            await migration.run();
            await markCustomMigrationCompleted(migration.id);
            logger.info('custom migration done', { id: migration.id });
        } catch (error) {
            logger.error('custom migration failed', {
                id: migration.id,
                error,
            });

            if (isDevelopmentMode()) {
                throw error;
            }
        }
    }
};

export default runCustomMigrations;
