import WatchHistoryVO from '@/common/types/WatchHistoryVO';

interface WatchHistoryService {
    list(basePath: string): Promise<WatchHistoryVO[]>;

    detail(folder: string): Promise<WatchHistoryVO | null>;

    /**
     * 添加媒体文件
     * @param filePaths 路径列表，可以是文件或文件夹
     */
    create(filePaths: string[]): Promise<string[]>;

    updateProgress(file: string, currentPosition: number): Promise<void>;

    attachSrt(videoPath: string, srtPath: string): Promise<void>;

    groupDelete(id: string): Promise<void>;

    analyseFolder(path: string): Promise<{ supported: number, unsupported: number }>;

    /**
     * 获取推荐的字幕文件
     * @param file 视频文件路径
     */
    suggestSrt(file: string): Promise<string[]>;

    /**
     * 获取下一个视频
     * @param currentId 当前视频ID
     */
    getNextVideo(currentId: string): Promise<WatchHistoryVO | null>;
}

export default WatchHistoryService;

