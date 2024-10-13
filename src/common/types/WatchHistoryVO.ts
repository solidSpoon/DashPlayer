type WatchHistoryVO = {
    basePath: string;
    fileName: string;
    isFolder: boolean;
    updatedAt: Date;
    duration: number;
    current_position: number;
    srtFile: string;
};
export default WatchHistoryVO;
