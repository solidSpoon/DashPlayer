import registerRoute from '@/backend/adapters/ipc/registerRoute';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import Controller from '@/backend/adapters/controllers/Controller';
import WatchHistoryService from '@/backend/application/services/WatchHistoryService';
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

    public async create(files: string[], concatLibrary = false): Promise<string[]> {
        return this.watchHistoryService.create(files, concatLibrary);
    }

    public async attachSrt({ videoPath, srtPath }: { videoPath: string, srtPath: string | 'same' }): Promise<void> {
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

    public async getNextVideo(currentId: string): Promise<WatchHistoryVO | null> {
        return this.watchHistoryService.getNextVideo(currentId);
    }

    registerRoutes(): void {
        registerRoute('watch-history/list', (p) => this.list(p));
        registerRoute('watch-history/progress/update', (p) => this.updateProgress(p));
        registerRoute('watch-history/create', (p) => this.create(p));
        registerRoute('watch-history/create/from-library', (p) => this.create(p, true));
        registerRoute('watch-history/group-delete', (p) => this.groupDelete(p));
        registerRoute('watch-history/detail', (p) => this.detail(p));
        registerRoute('watch-history/attach-srt', (p) => this.attachSrt(p));
        registerRoute('watch-history/suggest-srt', (p) => this.suggestSrt(p));
        registerRoute('watch-history/get-next-video', (p) => this.getNextVideo(p));
    }
}
