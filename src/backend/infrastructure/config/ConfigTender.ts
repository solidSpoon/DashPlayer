import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { ConfigStore, ConfigStoreReadOptions } from '@/backend/application/ports/gateways/ConfigStore';

/**
 * 配置文件托管类
 * @template T 配置类型
 * @template S Zod Schema 类型
 */
export class ConfigTender<T, S extends z.ZodType<T>> implements ConfigStore<T> {
    private readonly configPath: string;
    private readonly schema: S;
    private readonly defaultValue?: T;
    private readonly readOptions?: ConfigStoreReadOptions<T>;

    /**
     * 创建配置托管实例。
     * @param configPath 配置文件绝对路径。
     * @param schema 配置对象的 Zod 校验规则。
     * @param defaultValue 可选默认值；当文件不存在时会用它初始化文件。
     * @param readOptions 读取行为选项；可控制是否自动修复以及通知调用方。
     */
    constructor(configPath: string, schema: S, defaultValue?: T, readOptions?: ConfigStoreReadOptions<T>) {
        this.configPath = configPath;
        this.schema = schema;
        this.defaultValue = defaultValue;
        this.readOptions = readOptions;

        const dir = path.dirname(configPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        if (!fs.existsSync(configPath) && defaultValue !== undefined) {
            this.save(defaultValue);
        }
    }

    /**
     * 读取整个配置。
     * @returns 通过 schema 校验后的配置对象。
     * @description
     * 当文件内容损坏、缺失或不合法时：
     * - 若开启自动修复且存在默认值，则回退到默认值并重写文件；
     * - 若不存在默认值，则抛出读取错误。
     */
    get(): T {
        try {
            const content = fs.readFileSync(this.configPath, 'utf-8');
            const parsed = JSON.parse(content);
            return this.schema.parse(parsed);
        } catch (error) {
            this.readOptions?.onInvalid?.(error);

            /**
             * 是否允许读取失败后自动修复。
             */
            const autoRepairOnInvalid = this.readOptions?.autoRepairOnInvalid ?? true;
            if (autoRepairOnInvalid && this.defaultValue !== undefined) {
                const repairedValue = this.schema.parse(this.defaultValue);
                this.save(repairedValue);
                this.readOptions?.onAutoRepaired?.(repairedValue);
                return repairedValue;
            }
            throw new Error(`Failed to read config: ${error}`);
        }
    }

    /**
     * 保存整个配置。
     * @param config 待保存的配置对象。
     * @returns 无返回值。
     * @description 保存前会先执行 schema 校验，校验失败会抛错。
     */
    save(config: T): void {
        try {
            const validated = this.schema.parse(config);
            fs.writeFileSync(this.configPath, JSON.stringify(validated, null, 2));
        } catch (error) {
            throw new Error(`Failed to save config: ${error}`);
        }
    }
}
