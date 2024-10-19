type WatchHistoryVO = {
    id: string;
    basePath: string;
    fileName: string;
    isFolder: boolean;
    updatedAt: Date;
    duration: number;
    current_position: number;
    srtFile: string;
    playing: boolean;
};
export default WatchHistoryVO;
