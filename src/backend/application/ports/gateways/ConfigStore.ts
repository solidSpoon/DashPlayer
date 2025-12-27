import { z } from 'zod';

export interface ConfigStore<T> {
    get(): T;
    save(config: T): void;
}

export interface ConfigStoreFactory {
    create<T, S extends z.ZodType<T>>(configPath: string, schema: S, defaultValue?: T): ConfigStore<T>;
}

