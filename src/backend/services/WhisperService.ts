export default interface WhisperService {
    transcript(taskId: number, filePath: string): Promise<void>;
}
