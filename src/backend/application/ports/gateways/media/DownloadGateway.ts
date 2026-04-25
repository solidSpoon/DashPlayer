export interface DownloadMetadata {
    title: string;
    thumbnail?: string;
    url: string;
    duration?: number;
}

export interface DownloadOptions {
    taskId: number;
    url: string;
    savePath: string;
    onProgress?: (percent: number, speed?: string, eta?: string) => void;
    onCancelable?: (cancel: () => void) => void;
}

export default interface DownloadGateway {
    getMetadata(url: string): Promise<DownloadMetadata>;
    download(options: DownloadOptions): Promise<void>;
}
