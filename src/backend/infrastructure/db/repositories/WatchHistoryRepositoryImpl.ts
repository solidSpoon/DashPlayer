import { and, asc, desc, eq } from 'drizzle-orm';
import { injectable } from 'inversify';

import db from '@/backend/infrastructure/db';
import {
    InsertWatchHistory,
    watchHistory,
    WatchHistory,
} from '@/backend/infrastructure/db/tables/watchHistory';
import TimeUtil from '@/common/utils/TimeUtil';
import WatchHistoryRepository, {
    WatchHistoryDistinctBasePathFileName,
    WatchHistoryInsert,
    WatchHistoryProjectType,
    WatchHistoryRecord,
    WatchHistoryUpdatePatch,
} from '@/backend/services/repositories/WatchHistoryRepository';

/**
 * 使用 Drizzle 访问观看历史表，并将数据库行转换为 application 业务记录。
 */
@injectable()
export default class WatchHistoryRepositoryImpl implements WatchHistoryRepository {

    /**
     * 按 ID 查询观看记录。
     *
     * @param id 观看记录 ID。
     * @returns 找到的观看记录；不存在时返回 `null`。
     */
    public async findById(id: string): Promise<WatchHistoryRecord | null> {
        const rows: WatchHistory[] = await db
            .select()
            .from(watchHistory)
            .where(eq(watchHistory.id, id));
        return rows[0] ? this.toRecord(rows[0]) : null;
    }

    /**
     * 按目录和文件名查询观看记录。
     *
     * @param basePath 视频所在目录。
     * @param fileName 视频文件名。
     * @returns 匹配的观看记录列表。
     */
    public async findByBasePathFileName(basePath: string, fileName: string): Promise<WatchHistoryRecord[]> {
        const rows = await db
            .select()
            .from(watchHistory)
            .where(and(eq(watchHistory.base_path, basePath), eq(watchHistory.file_name, fileName)));
        return this.toRecords(rows);
    }

    /**
     * 按目录、文件名和记录类型查询观看记录。
     *
     * @param basePath 视频所在目录。
     * @param fileName 视频文件名。
     * @param type 记录所属类型。
     * @returns 匹配的观看记录列表。
     */
    public async findByBasePathFileNameType(
        basePath: string,
        fileName: string,
        type: WatchHistoryProjectType,
    ): Promise<WatchHistoryRecord[]> {
        const rows = await db
            .select()
            .from(watchHistory)
            .where(
                and(
                    eq(watchHistory.base_path, basePath),
                    eq(watchHistory.file_name, fileName),
                    eq(watchHistory.project_type, type),
                ),
            );
        return this.toRecords(rows);
    }

    /**
     * 查询指定目录、文件名和类型下的第一条记录。
     *
     * @param basePath 视频所在目录。
     * @param fileName 视频文件名。
     * @param type 记录所属类型。
     * @returns 第一条匹配记录；不存在时返回 `null`。
     */
    public async findOneByBasePathFileNameType(
        basePath: string,
        fileName: string,
        type: WatchHistoryProjectType,
    ): Promise<WatchHistoryRecord | null> {
        const rows = await this.findByBasePathFileNameType(basePath, fileName, type);
        return rows[0] ?? null;
    }

    /**
     * 查询目录中的观看记录，并按文件名升序排列。
     *
     * @param basePath 视频所在目录。
     * @param type 记录所属类型。
     * @returns 排序后的观看记录列表。
     */
    public async listByBasePathAndProjectTypeOrderedByFileName(
        basePath: string,
        type: WatchHistoryProjectType,
    ): Promise<WatchHistoryRecord[]> {
        const rows = await db
            .select()
            .from(watchHistory)
            .where(and(eq(watchHistory.base_path, basePath), eq(watchHistory.project_type, type)))
            .orderBy(asc(watchHistory.file_name));
        return this.toRecords(rows);
    }

    /**
     * 查询目录中的观看记录，并按更新时间倒序排列。
     *
     * @param basePath 视频所在目录。
     * @param type 记录所属类型。
     * @returns 排序后的观看记录列表。
     */
    public async listByBasePathAndProjectTypeOrderedByUpdatedAtDesc(
        basePath: string,
        type: WatchHistoryProjectType,
    ): Promise<WatchHistoryRecord[]> {
        const rows = await db
            .select()
            .from(watchHistory)
            .where(and(eq(watchHistory.base_path, basePath), eq(watchHistory.project_type, type)))
            .orderBy(desc(watchHistory.updated_at));
        return this.toRecords(rows);
    }

    /**
     * 查询指定类型的全部观看记录。
     *
     * @param type 记录所属类型。
     * @returns 观看记录列表。
     */
    public async listByProjectType(type: WatchHistoryProjectType): Promise<WatchHistoryRecord[]> {
        const rows = await db
            .select()
            .from(watchHistory)
            .where(eq(watchHistory.project_type, type));
        return this.toRecords(rows);
    }

    /**
     * 查询指定类型下去重后的目录列表。
     *
     * @param type 记录所属类型。
     * @returns 目录路径列表。
     */
    public async listDistinctFoldersByProjectType(type: WatchHistoryProjectType): Promise<string[]> {
        const rows: { folder: string }[] = await db
            .selectDistinct({ folder: watchHistory.base_path })
            .from(watchHistory)
            .where(eq(watchHistory.project_type, type));
        return rows.map((r) => r.folder);
    }

    /**
     * 判断目录下是否存在指定类型的观看记录。
     *
     * @param basePath 视频所在目录。
     * @param type 记录所属类型。
     * @returns 存在匹配记录时返回 `true`。
     */
    public async existsByBasePathAndProjectType(basePath: string, type: WatchHistoryProjectType): Promise<boolean> {
        const rows: WatchHistory[] = await db
            .select()
            .from(watchHistory)
            .where(and(eq(watchHistory.base_path, basePath), eq(watchHistory.project_type, type)));
        return rows.length > 0;
    }

    /**
     * 新增观看记录。
     *
     * @param values 待写入的业务记录字段。
     * @returns 写入后的观看记录。
     */
    public async insert(values: WatchHistoryInsert): Promise<WatchHistoryRecord> {
        const rows: WatchHistory[] = await db
            .insert(watchHistory)
            .values(values)
            .returning();
        const row = rows[0];
        if (!row) {
            throw new Error('insert watch history failed');
        }
        return this.toRecord(row);
    }

    /**
     * 按 ID 更新观看记录。
     *
     * @param id 观看记录 ID。
     * @param patch 待更新字段。
     */
    public async updateById(id: string, patch: WatchHistoryUpdatePatch): Promise<void> {
        await db
            .update(watchHistory)
            .set({
                ...patch,
                updated_at: patch.updated_at ?? TimeUtil.timeUtc(),
            } satisfies Partial<InsertWatchHistory>)
            .where(eq(watchHistory.id, id));
    }

    /**
     * 按目录和文件名更新观看记录。
     *
     * @param basePath 视频所在目录。
     * @param fileName 视频文件名。
     * @param patch 待更新字段。
     */
    public async updateByBasePathFileName(basePath: string, fileName: string, patch: WatchHistoryUpdatePatch): Promise<void> {
        await db
            .update(watchHistory)
            .set({
                ...patch,
                updated_at: patch.updated_at ?? TimeUtil.timeUtc(),
            } satisfies Partial<InsertWatchHistory>)
            .where(and(eq(watchHistory.base_path, basePath), eq(watchHistory.file_name, fileName)));
    }

    /**
     * 按 ID 删除观看记录。
     *
     * @param id 观看记录 ID。
     */
    public async deleteById(id: string): Promise<void> {
        await db.delete(watchHistory).where(eq(watchHistory.id, id));
    }

    /**
     * 按目录和文件名删除观看记录。
     *
     * @param basePath 视频所在目录。
     * @param fileName 视频文件名。
     */
    public async deleteByBasePathFileName(basePath: string, fileName: string): Promise<void> {
        await db
            .delete(watchHistory)
            .where(and(eq(watchHistory.base_path, basePath), eq(watchHistory.file_name, fileName)));
    }

    /**
     * 查询去重后的目录和文件名组合。
     *
     * @returns 去重后的路径组合列表。
     */
    public async listDistinctBasePathFileName(): Promise<WatchHistoryDistinctBasePathFileName[]> {
        return db
            .selectDistinct({
                base_path: watchHistory.base_path,
                file_name: watchHistory.file_name,
            })
            .from(watchHistory);
    }

    /**
     * 查询引用指定字幕文件的观看记录。
     *
     * @param srtFile 字幕文件路径。
     * @returns 引用该字幕文件的观看记录列表。
     */
    public async findBySrtFile(srtFile: string): Promise<WatchHistoryRecord[]> {
        const rows = await db
            .select()
            .from(watchHistory)
            .where(eq(watchHistory.srt_file, srtFile));
        return this.toRecords(rows);
    }

    /**
     * 将数据库行转换为 application 层使用的观看历史记录。
     *
     * @param row Drizzle 查询返回的数据库行。
     * @returns 不暴露数据库表类型的业务记录。
     */
    private toRecord(row: WatchHistory): WatchHistoryRecord {
        return {
            ...row,
            project_type: row.project_type as WatchHistoryProjectType,
        };
    }

    /**
     * 批量转换数据库行，保持仓储方法的返回结构简单。
     *
     * @param rows Drizzle 查询返回的数据库行列表。
     * @returns application 层使用的业务记录列表。
     */
    private toRecords(rows: WatchHistory[]): WatchHistoryRecord[] {
        return rows.map((row) => this.toRecord(row));
    }
}
