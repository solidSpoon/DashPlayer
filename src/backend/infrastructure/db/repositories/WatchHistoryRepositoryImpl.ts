import { and, asc, desc, eq } from 'drizzle-orm';
import { injectable } from 'inversify';

import db from '@/backend/infrastructure/db';
import { InsertWatchHistory, watchHistory, WatchHistory, WatchHistoryType } from '@/backend/infrastructure/db/tables/watchHistory';
import TimeUtil from '@/common/utils/TimeUtil';
import WatchHistoryRepository, {
    WatchHistoryDistinctBasePathFileName,
    WatchHistoryUpdatePatch,
} from '@/backend/application/ports/repositories/WatchHistoryRepository';

@injectable()
export default class WatchHistoryRepositoryImpl implements WatchHistoryRepository {

    public async findById(id: string): Promise<WatchHistory | null> {
        const rows: WatchHistory[] = await db
            .select()
            .from(watchHistory)
            .where(eq(watchHistory.id, id));
        return rows[0] ?? null;
    }

    public async findByBasePathFileName(basePath: string, fileName: string): Promise<WatchHistory[]> {
        return db
            .select()
            .from(watchHistory)
            .where(and(eq(watchHistory.base_path, basePath), eq(watchHistory.file_name, fileName)));
    }

    public async findByBasePathFileNameType(basePath: string, fileName: string, type: WatchHistoryType): Promise<WatchHistory[]> {
        return db
            .select()
            .from(watchHistory)
            .where(
                and(
                    eq(watchHistory.base_path, basePath),
                    eq(watchHistory.file_name, fileName),
                    eq(watchHistory.project_type, type),
                ),
            );
    }

    public async findOneByBasePathFileNameType(
        basePath: string,
        fileName: string,
        type: WatchHistoryType
    ): Promise<WatchHistory | null> {
        const rows = await this.findByBasePathFileNameType(basePath, fileName, type);
        return rows[0] ?? null;
    }

    public async listByBasePathAndProjectTypeOrderedByFileName(basePath: string, type: WatchHistoryType): Promise<WatchHistory[]> {
        return db
            .select()
            .from(watchHistory)
            .where(and(eq(watchHistory.base_path, basePath), eq(watchHistory.project_type, type)))
            .orderBy(asc(watchHistory.file_name));
    }

    public async listByBasePathAndProjectTypeOrderedByUpdatedAtDesc(
        basePath: string,
        type: WatchHistoryType
    ): Promise<WatchHistory[]> {
        return db
            .select()
            .from(watchHistory)
            .where(and(eq(watchHistory.base_path, basePath), eq(watchHistory.project_type, type)))
            .orderBy(desc(watchHistory.updated_at));
    }

    public async listByProjectType(type: WatchHistoryType): Promise<WatchHistory[]> {
        return db
            .select()
            .from(watchHistory)
            .where(eq(watchHistory.project_type, type));
    }

    public async listDistinctFoldersByProjectType(type: WatchHistoryType): Promise<string[]> {
        const rows: { folder: string }[] = await db
            .selectDistinct({ folder: watchHistory.base_path })
            .from(watchHistory)
            .where(eq(watchHistory.project_type, type));
        return rows.map((r) => r.folder);
    }

    public async existsByBasePathAndProjectType(basePath: string, type: WatchHistoryType): Promise<boolean> {
        const rows: WatchHistory[] = await db
            .select()
            .from(watchHistory)
            .where(and(eq(watchHistory.base_path, basePath), eq(watchHistory.project_type, type)));
        return rows.length > 0;
    }

    public async insert(values: InsertWatchHistory): Promise<WatchHistory> {
        const rows: WatchHistory[] = await db
            .insert(watchHistory)
            .values(values)
            .returning();
        const row = rows[0];
        if (!row) {
            throw new Error('insert watch history failed');
        }
        return row;
    }

    public async updateById(id: string, patch: WatchHistoryUpdatePatch): Promise<void> {
        await db
            .update(watchHistory)
            .set({
                ...patch,
                updated_at: patch.updated_at ?? TimeUtil.timeUtc(),
            } satisfies Partial<InsertWatchHistory>)
            .where(eq(watchHistory.id, id));
    }

    public async updateByBasePathFileName(basePath: string, fileName: string, patch: WatchHistoryUpdatePatch): Promise<void> {
        await db
            .update(watchHistory)
            .set({
                ...patch,
                updated_at: patch.updated_at ?? TimeUtil.timeUtc(),
            } satisfies Partial<InsertWatchHistory>)
            .where(and(eq(watchHistory.base_path, basePath), eq(watchHistory.file_name, fileName)));
    }

    public async deleteById(id: string): Promise<void> {
        await db.delete(watchHistory).where(eq(watchHistory.id, id));
    }

    public async deleteByBasePathFileName(basePath: string, fileName: string): Promise<void> {
        await db
            .delete(watchHistory)
            .where(and(eq(watchHistory.base_path, basePath), eq(watchHistory.file_name, fileName)));
    }

    public async listDistinctBasePathFileName(): Promise<WatchHistoryDistinctBasePathFileName[]> {
        return db
            .selectDistinct({
                base_path: watchHistory.base_path,
                file_name: watchHistory.file_name,
            })
            .from(watchHistory);
    }

    public async findBySrtFile(srtFile: string): Promise<WatchHistory[]> {
        return db
            .select()
            .from(watchHistory)
            .where(eq(watchHistory.srt_file, srtFile));
    }
}
