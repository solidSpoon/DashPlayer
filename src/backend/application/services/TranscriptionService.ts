export interface TranscriptionService {
    /**
     * 开始转录任务
     * @param filePath 音频/视频文件路径
     */
    transcribe(filePath: string): Promise<void>;
    
    /**
     * 取消转录任务
     * @param filePath 文件路径
     * @returns 是否成功取消
     */
    cancel(filePath: string): boolean;
}