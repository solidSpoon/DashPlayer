export default interface DlVideoService {
    dlVideo(taskId: number, url: string, savePath: string): Promise<void>;
}
