import type { MainLogger } from '@/backend/infrastructure/logger';
import type { Db } from '@/backend/infrastructure/db/createDb';
import type { SettingKey } from '@/common/types/store_schema';

/**
 * 迁移专用的配置存储通道。
 *
 * 读取侧（getPersisted / hasPersisted）是「用户是否真实持久化过」语义：
 * 不做 schema 默认值兜底，且允许访问已从 schema 移除的历史键；
 * 写入侧（set / delete）统一走 store.ts 单例落盘。
 */
export interface CustomMigrationSettings {
    /** 读取真实持久化的非空字符串；键可以是历史键；未持久化返回 null。 */
    getPersisted(key: string): string | null;
    /** 判断键是否被真实持久化过（配置文件里存在该键），与 schema 默认值无关。 */
    hasPersisted(key: string): boolean;
    /** 通过单例写入设置值；空值按「回落 schema 默认值」语义处理。 */
    set(key: SettingKey, value: string | null | undefined): boolean;
    /** 通过单例删除设置项（含历史键），避免跨实例快照把已删键写回磁盘。 */
    delete(key: string): void;
}

/**
 * 单个迁移的执行上下文。
 *
 * 迁移对配置存储的全部访问都必须经过 ctx.settings：独立创建 electron-store
 * 实例的内存快照看不到其他迁移的写入，跨实例读写是迁移漏迁移的经典根因
 * （store-schema-dictionary-youdao-v2 曾因此漏迁）。
 */
export interface CustomMigrationContext {
    /** 配置存储通道。 */
    settings: CustomMigrationSettings;
    /** drizzle 数据库单例；涉及 SQLite 数据搬移的迁移使用。 */
    db: Db;
    /** 按迁移 id 命名的子 logger，迁移内用它输出结构化变更记录。 */
    logger: MainLogger;
}

export type CustomMigration = {
    id: string;
    description: string;
    run: (ctx: CustomMigrationContext) => Promise<void>;
};

/**
 * 自定义迁移执行失败错误：携带失败迁移的身份，供启动恢复流程（gate 页）
 * 展示失败点与原因。
 */
export class MigrationRunError extends Error {
    /** 失败的迁移 id。 */
    public readonly migrationId: string;
    /** 失败的迁移描述。 */
    public readonly migrationDescription: string;
    /** 原始错误信息（迁移内部抛出的任意值规范化为字符串）。 */
    public readonly causeMessage: string;

    constructor(migrationId: string, migrationDescription: string, cause: unknown) {
        const causeMessage = cause instanceof Error ? cause.message : String(cause);
        super(`自定义迁移 ${migrationId} 执行失败：${causeMessage}`);
        this.name = 'MigrationRunError';
        this.migrationId = migrationId;
        this.migrationDescription = migrationDescription;
        this.causeMessage = causeMessage;
    }
}
