import { injectable } from 'inversify';

export interface ParakeetService {
    initialize(): Promise<void>;
    isModelDownloaded(): Promise<boolean>;
    checkModelDownloaded(): Promise<boolean>;
    checkModel(): Promise<{ success: boolean; log: string }>;
    downloadModel(progressCallback: (progress: number) => void): Promise<void>;
    transcribeAudio(taskId: number, audioPath: string): Promise<any>;
    generateSrt(taskId: number, audioPath: string, outputPath: string): Promise<void>;
    dispose(): void;
}