import WatchHistoryVO from '@/common/types/WatchHistoryVO';

interface WatchHistoryService {
    list(): Promise<WatchHistoryVO[]>;

    detail(folder: string) : Promise<WatchHistoryVO[]>;
    /**
     * 添加媒体文件
     * @param filePath 文件或文件夹路径
     */
    create(filePaths: string[]): Promise<void>;

    updateProgress(file: string, duration: number): Promise<void>;
}

export default WatchHistoryService;

