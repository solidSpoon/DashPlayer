import runMigrate from '@/backend/infrastructure/db/migrate';
import { getMainLogger } from '@/backend/infrastructure/logger';

import runCustomMigrations from './customMigrations/runCustomMigrations';

const logger = getMainLogger('startup-migrations');

const runStartupMigrations = async (): Promise<void> => {
    logger.info('running drizzle migrations');
    await runMigrate();

    logger.info('running custom migrations');
    await runCustomMigrations();
};

export default runStartupMigrations;
