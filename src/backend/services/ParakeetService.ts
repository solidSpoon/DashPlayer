export interface ParakeetService {
    initialize(): Promise<void>;
    isModelDownloaded(): Promise<boolean>;
    transcribeAudio(taskId: number, audioPath: string): Promise<any>;
    generateSrt(taskId: number, audioPath: string, outputPath: string): Promise<void>;
    generateSrtFromResult(taskId: number, audioPath: string, outputPath: string, transcriptionResult: any): Promise<void>;
    dispose(): void;
}
