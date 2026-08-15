/**
 * 观看历史记录的所属类型。
 *
 * FILE 表示独立添加的视频，DIRECTORY 表示目录中的视频。
 */
export enum WatchHistoryProjectType {
    FILE = 1,
    DIRECTORY = 2,
}

/**
 * 观看历史仓储返回的业务记录。
 *
 * 这里使用普通 TypeScript 类型，避免 application 层依赖数据库表定义。
 */
export type WatchHistoryRecord = {
    /** 观看记录的稳定 ID。 */
    id: string;
    /** 视频所在目录的绝对路径。 */
    base_path: string;
    /** 视频文件名。 */
    file_name: string;
    /** 记录所属类型。 */
    project_type: WatchHistoryProjectType;
    /** 当前播放位置，单位为秒。 */
    current_position: number;
    /** 已关联的字幕文件路径；未关联时为 null。 */
    srt_file: string | null;
    /** 记录创建时间，数据库格式的时间字符串。 */
    created_at: string;
    /** 记录最近更新时间，数据库格式的时间字符串。 */
    updated_at: string;
};

/**
 * 新增观看历史记录所需的数据。
 */
export type WatchHistoryInsert = Pick<
    WatchHistoryRecord,
    'id' | 'base_path' | 'file_name' | 'project_type' | 'current_position'
> & Partial<Pick<WatchHistoryRecord, 'srt_file' | 'created_at' | 'updated_at'>>;

/**
 * 观看历史记录允许更新的字段。
 */
export type WatchHistoryUpdatePatch = Partial<
    Pick<WatchHistoryRecord, 'current_position' | 'srt_file' | 'updated_at'>
>;

/**
 * 按目录和文件名去重后的观看历史路径。
 */
export type WatchHistoryDistinctBasePathFileName = {
    /** 视频所在目录。 */
    base_path: string;
    /** 视频文件名。 */
    file_name: string;
};

export default interface WatchHistoryRepository {
    findById(id: string): Promise<WatchHistoryRecord | null>;
    findByBasePathFileName(basePath: string, fileName: string): Promise<WatchHistoryRecord[]>;
    findByBasePathFileNameType(
        basePath: string,
        fileName: string,
        type: WatchHistoryProjectType,
    ): Promise<WatchHistoryRecord[]>;
    findOneByBasePathFileNameType(
        basePath: string,
        fileName: string,
        type: WatchHistoryProjectType,
    ): Promise<WatchHistoryRecord | null>;
    listByBasePathAndProjectTypeOrderedByFileName(
        basePath: string,
        type: WatchHistoryProjectType,
    ): Promise<WatchHistoryRecord[]>;
    listByBasePathAndProjectTypeOrderedByUpdatedAtDesc(
        basePath: string,
        type: WatchHistoryProjectType,
    ): Promise<WatchHistoryRecord[]>;
    listByProjectType(type: WatchHistoryProjectType): Promise<WatchHistoryRecord[]>;
    listDistinctFoldersByProjectType(type: WatchHistoryProjectType): Promise<string[]>;
    existsByBasePathAndProjectType(basePath: string, type: WatchHistoryProjectType): Promise<boolean>;
    insert(values: WatchHistoryInsert): Promise<WatchHistoryRecord>;
    updateById(id: string, patch: WatchHistoryUpdatePatch): Promise<void>;
    updateByBasePathFileName(basePath: string, fileName: string, patch: WatchHistoryUpdatePatch): Promise<void>;
    deleteById(id: string): Promise<void>;
    deleteByBasePathFileName(basePath: string, fileName: string): Promise<void>;
    listDistinctBasePathFileName(): Promise<WatchHistoryDistinctBasePathFileName[]>;
    findBySrtFile(srtFile: string): Promise<WatchHistoryRecord[]>;
}
