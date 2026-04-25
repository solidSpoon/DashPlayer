import registerRoute from '@/backend/adapters/ipc/registerRoute';
import Controller from '@/backend/adapters/controllers/Controller';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import DownloadService from '@/backend/application/services/DownloadService';
import { DownloadMetadata } from '@/backend/application/ports/gateways/media/DownloadGateway';

@injectable()
export default class DownloadController implements Controller {
    @inject(TYPES.DownloadService)
    private downloadService!: DownloadService;

    public async start(params: { url: string; savePath?: string }): Promise<number> {
        return this.downloadService.startDownload(params.url, params.savePath);
    }

    public async getMetadata(url: string): Promise<DownloadMetadata> {
        return this.downloadService.getMetadata(url);
    }

    registerRoutes(): void {
        registerRoute('download/start', (p) => this.start(p));
        registerRoute('download/get-metadata', (p) => this.getMetadata(p));
    }
}
