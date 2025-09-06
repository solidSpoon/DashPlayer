import { injectable } from 'inversify';

export interface ParakeetService {
    initialize(): Promise<void>;
    isModelDownloaded(): Promise<boolean>;
    downloadModel(progressCallback: (progress: number) => void): Promise<void>;
    transcribeAudio(taskId: number, audioPath: string): Promise<any>;
    generateSrt(taskId: number, audioPath: string, outputPath: string): Promise<void>;
    dispose(): void;
}