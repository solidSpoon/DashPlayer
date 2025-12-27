import { InsertWatchHistory, WatchHistory, WatchHistoryType } from '@/backend/infrastructure/db/tables/watchHistory';

export type WatchHistoryUpdatePatch = Partial<Pick<InsertWatchHistory, 'current_position' | 'srt_file' | 'updated_at'>>;

export type WatchHistoryDistinctBasePathFileName = {
    base_path: string;
    file_name: string;
};

export default interface WatchHistoryRepository {
    findById(id: string): Promise<WatchHistory | null>;
    findByBasePathFileName(basePath: string, fileName: string): Promise<WatchHistory[]>;
    findByBasePathFileNameType(basePath: string, fileName: string, type: WatchHistoryType): Promise<WatchHistory[]>;
    findOneByBasePathFileNameType(basePath: string, fileName: string, type: WatchHistoryType): Promise<WatchHistory | null>;
    listByBasePathAndProjectTypeOrderedByFileName(basePath: string, type: WatchHistoryType): Promise<WatchHistory[]>;
    listByBasePathAndProjectTypeOrderedByUpdatedAtDesc(basePath: string, type: WatchHistoryType): Promise<WatchHistory[]>;
    listByProjectType(type: WatchHistoryType): Promise<WatchHistory[]>;
    listDistinctFoldersByProjectType(type: WatchHistoryType): Promise<string[]>;
    existsByBasePathAndProjectType(basePath: string, type: WatchHistoryType): Promise<boolean>;
    insert(values: InsertWatchHistory): Promise<WatchHistory>;
    updateById(id: string, patch: WatchHistoryUpdatePatch): Promise<void>;
    updateByBasePathFileName(basePath: string, fileName: string, patch: WatchHistoryUpdatePatch): Promise<void>;
    deleteById(id: string): Promise<void>;
    deleteByBasePathFileName(basePath: string, fileName: string): Promise<void>;
    listDistinctBasePathFileName(): Promise<WatchHistoryDistinctBasePathFileName[]>;
    findBySrtFile(srtFile: string): Promise<WatchHistory[]>;
}
