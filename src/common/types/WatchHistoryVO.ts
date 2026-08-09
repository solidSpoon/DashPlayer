type WatchHistoryVO = {
    id: string;
    basePath: string;
    fileName: string;
    /**
     * Optional label shown in UI; `fileName` remains the actual playback target.
     */
    displayFileName?: string;
    isFolder: boolean;
    updatedAt: Date;
    duration: number;
    current_position: number;
    srtFile: string;
    playing: boolean;
    /**
     * 用户是否手动设置过播客模式；未设置过时该字段为 null。
     */
    podcastModeUserSet: boolean | null;
    /**
     * 用户手动选择的播客模式（true=播客模式，false=普通模式）；未设置过时为 null。
     */
    podcastModeManual: boolean | null;
};
export default WatchHistoryVO;
