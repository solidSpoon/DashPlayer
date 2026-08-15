import { z } from 'zod';

/**
 * 配置读取行为选项。
 * @template T 配置对象类型。
 */
export interface ConfigStoreReadOptions<T> {
    /**
     * 读取异常时是否自动回退默认值并修复文件。
     * 为空时默认开启。
     */
    autoRepairOnInvalid?: boolean;

    /**
     * 当读取失败（JSON 解析失败或 schema 校验失败）时触发。
     * @param error 原始异常对象。
     */
    onInvalid?: (error: unknown) => void;

    /**
     * 当执行自动修复成功后触发。
     * @param repairedValue 回写到文件中的修复值。
     */
    onAutoRepaired?: (repairedValue: T) => void;
}

export interface ConfigStore<T> {
    get(): T;
    save(config: T): void;
}

export interface ConfigStoreFactory {
    create<T, S extends z.ZodType<T>>(
        configPath: string,
        schema: S,
        defaultValue?: T,
        readOptions?: ConfigStoreReadOptions<T>,
    ): ConfigStore<T>;
}
