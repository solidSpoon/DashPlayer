export interface TranscriptionService {
    /**
     * 开始转录任务
     * @param taskId 任务ID
     * @param filePath 音频/视频文件路径
     */
    transcribe(taskId: number, filePath: string): Promise<void>;
    
    /**
     * 取消转录任务
     * @param taskId 任务ID
     * @returns 是否成功取消
     */
    cancel(taskId: number): boolean;
}