export interface ParakeetService {
    initialize(): Promise<void>;
    isModelDownloaded(): Promise<boolean>;
    transcribeAudio(taskId: number, audioPath: string, filePath?: string): Promise<any>;
    generateSrtFromResult(taskId: number, audioPath: string, outputPath: string, transcriptionResult: any): Promise<void>;
    cancelTranscription(taskId: number): boolean;
    getTaskStatus(taskId: number): any;
    getActiveTasks(): any[];
    dispose(): void;
}
