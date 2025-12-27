import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { ConfigStore } from '@/backend/application/ports/gateways/ConfigStore';

/**
 * 配置文件托管类
 * @template T 配置类型
 * @template S Zod Schema 类型
 */
export class ConfigTender<T, S extends z.ZodType<T>> implements ConfigStore<T> {
    private readonly configPath: string;
    private readonly schema: S;

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
        try {
            const content = fs.readFileSync(this.configPath, 'utf-8');
            const parsed = JSON.parse(content);
            return this.schema.parse(parsed);
        } catch (error) {
            throw new Error(`Failed to read config: ${error}`);
        }
    }

    /**
     * 保存整个配置
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
