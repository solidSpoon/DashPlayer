/**
 * 启动迁移失败详情（migration-failure/detail 返回）。
 *
 * failed 为 false 表示迁移全部成功；恢复模式下携带失败阶段与迁移身份，
 * 供 gate 页展示与错误反馈。
 */
export interface MigrationFailureDetail {
    /** 本次启动是否发生了迁移失败。 */
    failed: boolean;
    /** 失败阶段：'drizzle' 为数据库 schema 迁移，'custom' 为自定义数据迁移。 */
    phase: 'drizzle' | 'custom' | null;
    /** 失败的自定义迁移 id；drizzle 阶段为 null。 */
    migrationId: string | null;
    /** 失败的迁移描述；drizzle 阶段为 null。 */
    description: string | null;
    /** 原始错误信息，供用户复制反馈。 */
    errorMessage: string | null;
}
