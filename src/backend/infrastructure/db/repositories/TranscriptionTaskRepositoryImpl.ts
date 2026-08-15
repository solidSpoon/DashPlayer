import { asc, eq, or } from 'drizzle-orm';
import { injectable } from 'inversify';
import db from '@/backend/infrastructure/db';
import {
    transcriptionTask,
    TranscriptionTaskRow,
} from '@/backend/infrastructure/db/tables/transcriptionTask';
import TimeUtil from '@/common/utils/TimeUtil';
import {
    TranscriptTask,
    TranscriptTaskResult,
    TranscriptTaskState,
} from '@/common/contracts/transcript/transcript-task';
import TranscriptionTaskRepository, {
    CreateTranscriptionTaskParams,
    TranscriptionTaskUpdatePatch,
} from '@/backend/services/repositories/TranscriptionTaskRepository';

/**
 * 使用 Drizzle 访问本地转录任务表。
 */
@injectable()
export default class TranscriptionTaskRepositoryImpl implements TranscriptionTaskRepository {
    /**
     * 将数据库行转换为跨层转录任务，并拒绝未知状态或损坏的结果 JSON。
     *
     * @param row 数据库中的转录任务行。
     * @returns 前后端共用的转录任务。
     */
    private mapRow(row: TranscriptionTaskRow): TranscriptTask {
        const status = row.status === null ? undefined : row.status as TranscriptTaskState;
        if (status !== undefined && !Object.values(TranscriptTaskState).includes(status)) {
            throw new Error(`数据库中的转录任务状态无效: ${row.status}`);
        }

        let result: TranscriptTaskResult | undefined;
        if (row.result !== null) {
            result = JSON.parse(row.result) as TranscriptTaskResult;
        }

        return {
            file: row.file_path,
            status,
            result,
            created_at: row.created_at,
            updated_at: row.updated_at,
        };
    }

    /**
     * 查询全部转录任务，保持入队顺序。
     *
     * @returns 当前数据库中的转录任务列表。
     */
    public async list(): Promise<TranscriptTask[]> {
        const rows = await db
            .select()
            .from(transcriptionTask)
            .orderBy(asc(transcriptionTask.id));
        return rows.map((row) => this.mapRow(row));
    }

    /**
     * 按文件路径查询转录任务。
     *
     * @param filePath 待查询的绝对路径。
     * @returns 已存在的任务；不存在时返回 null。
     */
    public async findByFilePath(filePath: string): Promise<TranscriptTask | null> {
        const rows = await db
            .select()
            .from(transcriptionTask)
            .where(eq(transcriptionTask.file_path, filePath));
        return rows[0] ? this.mapRow(rows[0]) : null;
    }

    /**
     * 插入任务并按唯一路径保证并发请求只产生一条记录。
     *
     * @param params 新任务参数。
     * @returns 新建或已存在的任务。
     */
    public async createIfAbsent(params: CreateTranscriptionTaskParams): Promise<TranscriptTask> {
        await db
            .insert(transcriptionTask)
            .values({ file_path: params.filePath })
            .onConflictDoNothing({ target: transcriptionTask.file_path });

        const task = await this.findByFilePath(params.filePath);
        if (!task) {
            throw new Error(`创建转录任务后无法读取任务: ${params.filePath}`);
        }
        return task;
    }

    /**
     * 更新指定文件的状态和结果。
     *
     * @param filePath 任务文件路径。
     * @param patch 要写入的状态信息。
     */
    public async updateByFilePath(filePath: string, patch: TranscriptionTaskUpdatePatch): Promise<void> {
        const result = await db
            .update(transcriptionTask)
            .set({
                status: patch.status,
                result: patch.result === undefined ? null : JSON.stringify(patch.result),
                updated_at: TimeUtil.timeUtc(),
            })
            .where(eq(transcriptionTask.file_path, filePath));
        if (result.changes !== 1) {
            throw new Error(`待更新的转录任务不存在: ${filePath}`);
        }
    }

    /**
     * 删除指定文件的转录任务。
     *
     * @param filePath 任务文件路径。
     */
    public async deleteByFilePath(filePath: string): Promise<void> {
        const result = await db
            .delete(transcriptionTask)
            .where(eq(transcriptionTask.file_path, filePath));
        if (result.changes !== 1) {
            throw new Error(`待删除的转录任务不存在: ${filePath}`);
        }
    }

    /**
     * 将应用重启前未结束的任务标记为中断。
     */
    public async markActiveAsInterrupted(): Promise<void> {
        await db
            .update(transcriptionTask)
            .set({
                status: TranscriptTaskState.FAILED,
                result: JSON.stringify({ message: '转录任务已中断（应用重启），请重新转录' }),
                updated_at: TimeUtil.timeUtc(),
            })
            .where(or(
                eq(transcriptionTask.status, TranscriptTaskState.INIT),
                eq(transcriptionTask.status, TranscriptTaskState.IN_PROGRESS),
            ));
    }
}
