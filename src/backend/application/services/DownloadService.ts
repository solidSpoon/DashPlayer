import { DownloadMetadata } from '@/backend/application/ports/gateways/media/DownloadGateway';

export default interface DownloadService {
    getMetadata(url: string): Promise<DownloadMetadata>;
    startDownload(url: string, savePath?: string): Promise<number>;
}
