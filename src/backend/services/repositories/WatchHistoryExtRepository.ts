/**
 * 观看记录扩展表的领域层结果类型。
 *
 * 端口不直接暴露 drizzle 表行类型，避免应用层耦合基础设施细节。
 */
export type WatchHistoryExtRecord = {
    /**
     * 用户是否手动设置过播客模式。
     */
    podcast_mode_user_set: boolean;
    /**
     * 用户手动选择的播客模式值（true=播客模式，false=普通模式）。
     */
    podcast_mode_manual: boolean;
};

export type WatchHistoryExtPatch = Partial<Pick<WatchHistoryExtRecord, 'podcast_mode_user_set' | 'podcast_mode_manual'>>;

export default interface WatchHistoryExtRepository {
    findByWatchHistoryId(watchHistoryId: string): Promise<WatchHistoryExtRecord | null>;
    upsert(watchHistoryId: string, patch: WatchHistoryExtPatch): Promise<WatchHistoryExtRecord>;
    deleteByWatchHistoryId(watchHistoryId: string): Promise<void>;
}
