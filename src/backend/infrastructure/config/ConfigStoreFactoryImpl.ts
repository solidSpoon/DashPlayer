import { injectable } from 'inversify';
import { z } from 'zod';

import { ConfigStore, ConfigStoreFactory } from '@/backend/application/ports/gateways/ConfigStore';
import { ConfigTender } from '@/backend/infrastructure/config/ConfigTender';

@injectable()
export default class ConfigStoreFactoryImpl implements ConfigStoreFactory {
    create<T, S extends z.ZodType<T>>(configPath: string, schema: S, defaultValue?: T): ConfigStore<T> {
        return new ConfigTender<T, S>(configPath, schema, defaultValue);
    }
}

