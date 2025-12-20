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
};
export default WatchHistoryVO;
