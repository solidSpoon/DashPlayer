import { asc, eq } from 'drizzle-orm';
import { inject, injectable } from 'inversify';
import type { Db } from '@/backend/infrastructure/db/createDb';
import { repairTask, RepairTaskRow } from '@/backend/infrastructure/db/tables/repairTask';
import TYPES from '@/backend/ioc/types';
import {
    RepairRecipe,
    RepairReason,
    RepairTask,
    RepairTaskState,
    RepairTaskUpdatePatch,
} from '@/common/contracts/playback-repair';
import RepairTaskRepository, {
    CreateRepairTaskParams,
} from '@/backend/services/repositories/RepairTaskRepository';

/**
 * 使用 Drizzle 访问播放修复记录表。
 */
@injectable()
export default class RepairTaskRepositoryImpl implements RepairTaskRepository {
    /**
     * @param db 由依赖容器注入的 drizzle 实例；测试中可替换为内存库。
     */
    constructor(@inject(TYPES.Database) private readonly db: Db) {}

    /**
     * 将数据库行转换为跨层修复记录，并拒绝未知状态。
     *
     * @param row 数据库中的修复记录行。
     * @returns 前后端共用的修复记录。
     */
    private mapRow(row: RepairTaskRow): RepairTask {
        const status = row.status === null ? undefined : row.status as RepairTaskState;
        if (status !== undefined && !Object.values(RepairTaskState).includes(status)) {
            throw new Error(`数据库中的修复状态无效: ${row.status}`);
        }

        return {
            file: row.file_path,
            status,
            recipe: (row.recipe ?? undefined) as RepairRecipe | undefined,
            outputPath: row.output_path ?? undefined,
            reason: (row.reason ?? undefined) as RepairReason | undefined,
            error: row.error ?? undefined,
            created_at: row.created_at,
            updated_at: row.updated_at,
        };
    }

    /**
     * 查询全部修复记录，保持入队顺序。
     *
     * @returns 当前数据库中的修复记录。
     */
    public async list(): Promise<RepairTask[]> {
        const rows = await this.db.select().from(repairTask).orderBy(asc(repairTask.id));
        return rows.map((row) => this.mapRow(row));
    }

    /**
     * 按媒体路径查询记录。
     *
     * @param filePath 媒体绝对路径。
     * @returns 记录；不存在时返回 `null`。
     */
    public async findByFilePath(filePath: string): Promise<RepairTask | null> {
        const rows = await this.db.select().from(repairTask).where(eq(repairTask.file_path, filePath)).limit(1);
        return rows.length > 0 ? this.mapRow(rows[0]) : null;
    }

    /**
     * 插入修复记录；路径重复时返回已有记录。
     *
     * @param params 新建参数。
     * @returns 新建或已存在的记录。
     */
    public async createIfAbsent(params: CreateRepairTaskParams): Promise<RepairTask> {
        const existing = await this.findByFilePath(params.filePath);
        if (existing) {
            return existing;
        }
        const inserted = await this.db.insert(repairTask).values({
            file_path: params.filePath,
            status: RepairTaskState.INIT,
        }).onConflictDoNothing().returning();
        if (inserted.length > 0) {
            return this.mapRow(inserted[0]);
        }
        // 并发插入时另一条写入抢先成功，回读它写下的记录。
        const raced = await this.findByFilePath(params.filePath);
        if (!raced) {
            throw new Error(`修复记录插入失败：${params.filePath}`);
        }
        return raced;
    }

    /**
     * 更新指定记录的状态；记录已被删除时直接返回。
     *
     * @param filePath 媒体绝对路径。
     * @param patch 待更新字段。
     */
    public async updateByFilePath(filePath: string, patch: RepairTaskUpdatePatch): Promise<void> {
        await this.db.update(repairTask).set({
            status: patch.status,
            recipe: patch.recipe ?? null,
            output_path: patch.outputPath ?? null,
            reason: patch.reason ?? null,
            error: patch.error ?? null,
            updated_at: new Date().toISOString(),
        }).where(eq(repairTask.file_path, filePath));
    }

    /**
     * 删除指定记录。
     *
     * @param filePath 媒体绝对路径。
     */
    public async deleteByFilePath(filePath: string): Promise<void> {
        await this.db.delete(repairTask).where(eq(repairTask.file_path, filePath));
    }

    /**
     * 将重启前遗留的进行中记录标记为已中断。
     *
     * 修复任务只存活在进程内，因此进程重新启动后不可能还有任务在跑。
     */
    public async markActiveAsInterrupted(): Promise<void> {
        await this.db.update(repairTask).set({
            status: RepairTaskState.CANCELLED,
            error: '应用重启导致修复中断',
            updated_at: new Date().toISOString(),
        }).where(eq(repairTask.status, RepairTaskState.IN_PROGRESS));
    }
}
