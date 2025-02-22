import { z } from 'zod';
import fs from 'fs';
import path from 'path';

/**
 * 配置文件托管类
 * @template T 配置类型
 * @template S Zod Schema 类型
 */
export class ConfigTender<T, S extends z.ZodType<T>> {
    private readonly configPath: string;
    private readonly schema: S;
    private cache: T | null = null;

    constructor(configPath: string, schema: S, defaultValue?: T) {
        this.configPath = configPath;
        this.schema = schema;

        // 确保目录存在
        const dir = path.dirname(configPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // 如果文件不存在且提供了默认值，则创建文件
        if (!fs.existsSync(configPath) && defaultValue) {
            this.save(defaultValue);
        }
    }

    /**
     * 读取整个配置
     */
    get(): T {
        if (this.cache) return this.cache;

        try {
            const content = fs.readFileSync(this.configPath, 'utf-8');
            const parsed = JSON.parse(content);
            const validated = this.schema.parse(parsed);
            this.cache = validated;
            return validated;
        } catch (error) {
            throw new Error(`Failed to read config: ${error}`);
        }
    }

    /**
     * 读取配置，如果不存在则返回默认值
     */
    getOrDefault(defaultValue: T): T {
        try {
            return this.get();
        } catch {
            return defaultValue;
        }
    }

    /**
     * 获取特定键的值
     */
    getKey<K extends keyof T>(key: K): T[K] {
        return this.get()[key];
    }

    /**
     * 保存整个配置
     */
    save(config: T): void {
        try {
            const validated = this.schema.parse(config);
            fs.writeFileSync(this.configPath, JSON.stringify(validated, null, 2));
            this.cache = validated;
        } catch (error) {
            throw new Error(`Failed to save config: ${error}`);
        }
    }

    /**
     * 设置特定键的值
     */
    setKey<K extends keyof T>(key: K, value: T[K]): void {
        const config = this.get();
        config[key] = value;
        this.save(config);
    }

    /**
     * 清除缓存
     */
    clearCache(): void {
        this.cache = null;
    }
}

// 使用示例：
/*
const UserConfigSchema = z.object({
    name: z.string(),
    age: z.number(),
    preferences: z.object({
        theme: z.enum(['light', 'dark']),
        notifications: z.boolean()
    })
});

type UserConfig = z.infer<typeof UserConfigSchema>;

const defaultConfig: UserConfig = {
    name: "Default User",
    age: 25,
    preferences: {
        theme: "light",
        notifications: true
    }
};

const configTender = new ConfigTender<UserConfig, typeof UserConfigSchema>(
    './config.json',
    UserConfigSchema,
    defaultConfig
);

// 使用示例
const config = configTender.get();
const name = configTender.getKey('name');
configTender.setKey('age', 30);
configTender.save({...config, name: "New Name"});
*/
