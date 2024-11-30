import registerRoute from '@/common/api/register';
import path from 'path';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import Controller from '@/backend/interfaces/controller';
import WatchHistoryService from '@/backend/services/WatchHistoryService';
import WatchHistoryVO from '@/common/types/WatchHistoryVO';

@injectable()
export default class WatchHistoryController implements Controller {
    @inject(TYPES.WatchHistoryService)
    private watchHistoryService!: WatchHistoryService;

    public async updateProgress({ file, currentPosition }: {
        file: string, currentPosition: number
    }): Promise<void> {
        return this.watchHistoryService.updateProgress(file, currentPosition);
    }

    public async create(files: string[]): Promise<string[]> {
        return this.watchHistoryService.create(files);
    }

    public async attachSrt({ videoPath, srtPath }: { videoPath: string, srtPath: string | 'same' }): Promise<void> {
        if (srtPath === 'same') {
            srtPath = path.join(path.dirname(videoPath), path.basename(videoPath, path.extname(videoPath)) + '.srt');
        }
        await this.watchHistoryService.attachSrt(videoPath, srtPath);
    }

    public async suggestSrt(file: string): Promise<string[]> {
        return this.watchHistoryService.suggestSrt(file);
    }

    public async groupDelete(id: string): Promise<void> {
        return this.watchHistoryService.groupDelete(id);
    }

    public async list(p: string): Promise<WatchHistoryVO[]> {
        return this.watchHistoryService.list(p);
    }

    public async detail(id: string): Promise<WatchHistoryVO | null> {
        return this.watchHistoryService.detail(id);
    }
    public async analyseFolder(path: string): Promise<{ supported: number, unsupported: number }> {
        return this.watchHistoryService.analyseFolder(path);
    }
    registerRoutes(): void {
        registerRoute('watch-history/list', (p) => this.list(p));
        registerRoute('watch-history/progress/update', (p) => this.updateProgress(p));
        registerRoute('watch-history/create', (p) => this.create(p));
        registerRoute('watch-history/group-delete', (p) => this.groupDelete(p));
        registerRoute('watch-history/detail', (p) => this.detail(p));
        registerRoute('watch-history/attach-srt', (p) => this.attachSrt(p));
        registerRoute('watch-history/suggest-srt', (p) => this.suggestSrt(p));
        registerRoute('watch-history/analyse-folder', (p) => this.analyseFolder(p));
    }
}
