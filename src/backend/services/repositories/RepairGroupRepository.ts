/**
 * 修复名单的分组来源类型。
 *
 * 只存来源，不存界面文案：标题由前端按来源与语言渲染，避免把界面文案写进数据库。
 */
export type RepairGroupSource = 'folder' | 'files';

/**
 * 组标记的写入参数。
 */
export interface RepairGroupMembership {
    /** 组标识。 */
    groupKey: string;
    /** 组来源类型。 */
    source: RepairGroupSource;
    /** 文件夹来源时的目录绝对路径。 */
    path?: string;
    /** 组内媒体绝对路径。 */
    filePath: string;
}

/**
 * 修复名单组标记的持久化端口。
 *
 * 组只是标记：成员关系没了不影响文件记录，文件记录没了也不影响别的组。
 */
export default interface RepairGroupRepository {
    /**
     * 把媒体加进某个组；重复加入不报错。
     *
     * @param memberships 待写入的成员关系。
     */
    addMemberships(memberships: RepairGroupMembership[]): Promise<void>;

    /**
     * 查询全部成员关系，按加入顺序返回。
     *
     * @returns 组标记列表。
     */
    listMemberships(): Promise<RepairGroupMembership[]>;

    /**
     * 查询某个文件所属的全部组标识。
     *
     * @param filePath 媒体绝对路径。
     * @returns 组标识列表。
     */
    listGroupKeysOfFile(filePath: string): Promise<string[]>;

    /**
     * 把媒体从某个组里移除。
     *
     * @param groupKey 组标识。
     * @param filePaths 媒体绝对路径列表。
     */
    removeFromGroup(groupKey: string, filePaths: string[]): Promise<void>;

    /**
     * 把媒体从它所属的全部组里移除。
     *
     * @param filePath 媒体绝对路径。
     */
    removeFileFromAllGroups(filePath: string): Promise<void>;

    /**
     * 删除整个组的成员关系。
     *
     * @param groupKey 组标识。
     */
    removeGroup(groupKey: string): Promise<void>;
}
