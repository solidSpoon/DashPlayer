import WatchHistoryVO from '@/common/types/WatchHistoryVO';

interface WatchHistoryService {
    list(basePath: string): Promise<WatchHistoryVO[]>;

    detail(folder: string): Promise<WatchHistoryVO | null>;

    /**
     * 添加媒体文件
     * @param filePaths
     */
    create(filePaths: string[]): Promise<string[]>;

    updateProgress(file: string, currentPosition: number): Promise<void>;

    attachSrt(videoPath: string, srtPath: string): Promise<void>;

    delete(id: string): Promise<void>;


    analyseFolder(path: string): Promise<{ supported: number, unsupported: number }>;
}

export default WatchHistoryService;

