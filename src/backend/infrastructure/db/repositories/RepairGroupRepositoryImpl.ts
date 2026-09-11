import { and, asc, eq, inArray } from 'drizzle-orm';
import { inject, injectable } from 'inversify';
import type { Db } from '@/backend/infrastructure/db/createDb';
import { repairGroupFile, RepairGroupFileRow } from '@/backend/infrastructure/db/tables/repairGroupFile';
import TYPES from '@/backend/ioc/types';
import RepairGroupRepository, {
    RepairGroupMembership,
    RepairGroupSource,
} from '@/backend/services/repositories/RepairGroupRepository';

/**
 * 使用 Drizzle 访问修复名单的组标记表。
 */
@injectable()
export default class RepairGroupRepositoryImpl implements RepairGroupRepository {
    /**
     * @param db 由依赖容器注入的 drizzle 实例；测试中可替换为内存库。
     */
    constructor(@inject(TYPES.Database) private readonly db: Db) {}

    /**
     * 把数据库行转换为成员关系，并拒绝未知来源类型。
     *
     * @param row 组标记行。
     * @returns 成员关系。
     */
    private mapRow(row: RepairGroupFileRow): RepairGroupMembership {
        const source = row.group_source as RepairGroupSource;
        if (source !== 'folder' && source !== 'files') {
            throw new Error(`数据库中的修复分组来源无效: ${row.group_source}`);
        }
        return {
            groupKey: row.group_key,
            source,
            path: row.group_path ?? undefined,
            filePath: row.file_path,
        };
    }

    /**
     * 把媒体加进某个组；重复加入不报错。
     *
     * @param memberships 待写入的成员关系。
     */
    public async addMemberships(memberships: RepairGroupMembership[]): Promise<void> {
        if (memberships.length === 0) {
            return;
        }
        await this.db.insert(repairGroupFile).values(memberships.map((item) => ({
            group_key: item.groupKey,
            group_source: item.source,
            group_path: item.path ?? null,
            file_path: item.filePath,
        }))).onConflictDoNothing();
    }

    /**
     * 查询全部成员关系，按加入顺序返回。
     *
     * @returns 组标记列表。
     */
    public async listMemberships(): Promise<RepairGroupMembership[]> {
        const rows = await this.db.select().from(repairGroupFile).orderBy(asc(repairGroupFile.id));
        return rows.map((row) => this.mapRow(row));
    }

    /**
     * 查询某个文件所属的全部组标识。
     *
     * @param filePath 媒体绝对路径。
     * @returns 组标识列表。
     */
    public async listGroupKeysOfFile(filePath: string): Promise<string[]> {
        const rows = await this.db
            .select({ groupKey: repairGroupFile.group_key })
            .from(repairGroupFile)
            .where(eq(repairGroupFile.file_path, filePath));
        return rows.map((row) => row.groupKey);
    }

    /**
     * 把媒体从某个组里移除。
     *
     * @param groupKey 组标识。
     * @param filePaths 媒体绝对路径列表。
     */
    public async removeFromGroup(groupKey: string, filePaths: string[]): Promise<void> {
        if (filePaths.length === 0) {
            return;
        }
        await this.db.delete(repairGroupFile).where(and(
            eq(repairGroupFile.group_key, groupKey),
            inArray(repairGroupFile.file_path, filePaths),
        ));
    }

    /**
     * 把媒体从它所属的全部组里移除。
     *
     * @param filePath 媒体绝对路径。
     */
    public async removeFileFromAllGroups(filePath: string): Promise<void> {
        await this.db.delete(repairGroupFile).where(eq(repairGroupFile.file_path, filePath));
    }

    /**
     * 删除整个组的成员关系。
     *
     * @param groupKey 组标识。
     */
    public async removeGroup(groupKey: string): Promise<void> {
        await this.db.delete(repairGroupFile).where(eq(repairGroupFile.group_key, groupKey));
    }
}
