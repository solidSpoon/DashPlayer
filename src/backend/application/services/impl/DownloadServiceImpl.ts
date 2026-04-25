import { inject, injectable } from 'inversify';
import DownloadService from '@/backend/application/services/DownloadService';
import DownloadGateway, { DownloadMetadata } from '@/backend/application/ports/gateways/media/DownloadGateway';
import DpTaskService from '@/backend/application/services/DpTaskService';
import TYPES from '@/backend/ioc/types';
import StorageDirectoryProvider, { StorageDirectoryTarget } from '@/backend/application/ports/gateways/storage/StorageDirectoryProvider';
import path from 'path';
import fs from 'fs';
import { getMainLogger } from '@/backend/infrastructure/logger';

@injectable()
export default class DownloadServiceImpl implements DownloadService {
    private logger = getMainLogger('DownloadServiceImpl');

    constructor(
        @inject(TYPES.DownloadGateway) private downloadGateway: DownloadGateway,
        @inject(TYPES.DpTaskService) private dpTaskService: DpTaskService,
        @inject(TYPES.StorageDirectoryProvider) private storageDirectoryProvider: StorageDirectoryProvider,
    ) {}

    public async getMetadata(url: string): Promise<DownloadMetadata> {
        return this.downloadGateway.getMetadata(url);
    }

    public async startDownload(url: string, savePath?: string): Promise<number> {
        const taskId = await this.dpTaskService.create();
        const metadata = await this.getMetadata(url);

        const libraryPath = await this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.VIDEOS);
        const safeTitle = metadata.title.replace(/[\\/:*?"<>|]/g, '_');
        const finalSavePath = savePath || path.join(libraryPath, `${safeTitle}.mp4`);

        // Ensure directory exists
        const dir = path.dirname(finalSavePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        this.downloadGateway.download({
            taskId,
            url,
            savePath: finalSavePath,
            onProgress: (percent, speed, eta) => {
                this.dpTaskService.process(taskId, {
                    progress: `下载中: ${percent}% ${speed ? `(${speed})` : ''} ${eta ? `ETA: ${eta}` : ''}`,
                    result: JSON.stringify({ percent, speed, eta, path: finalSavePath })
                });
            },
            onCancelable: (cancel) => {
                this.dpTaskService.registerTask(taskId, {
                    cancel: () => cancel()
                });
            }
        }).then(() => {
            this.dpTaskService.finish(taskId, {
                progress: '下载完成',
                result: JSON.stringify({ percent: 100, path: finalSavePath })
            });
        }).catch((err) => {
            this.logger.error('download failed', { error: err.message });
            this.dpTaskService.fail(taskId, {
                progress: `下载失败: ${err.message}`,
                result: JSON.stringify({ error: err.message })
            });
        });

        return taskId;
    }
}
