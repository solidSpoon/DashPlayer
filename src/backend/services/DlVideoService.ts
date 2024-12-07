export default interface DlVideoService {
    dlVideo(taskId: number, url: string,cookies: string, savePath: string): Promise<void>;
}
