import { injectable } from 'inversify';
import { z } from 'zod';

import { ConfigStore, ConfigStoreFactory, ConfigStoreReadOptions } from '@/backend/application/ports/gateways/ConfigStore';
import { ConfigTender } from '@/backend/infrastructure/config/ConfigTender';

@injectable()
export default class ConfigStoreFactoryImpl implements ConfigStoreFactory {
    /**
     * 创建配置托管对象。
     * @param configPath 配置文件路径。
     * @param schema 配置校验 schema。
     * @param defaultValue 默认配置值。
     * @param readOptions 读取行为选项（自动修复、回调通知等）。
     * @returns 可读写配置对象。
     */
    create<T, S extends z.ZodType<T>>(
        configPath: string,
        schema: S,
        defaultValue?: T,
        readOptions?: ConfigStoreReadOptions<T>,
    ): ConfigStore<T> {
        return new ConfigTender<T, S>(configPath, schema, defaultValue, readOptions);
    }
}
