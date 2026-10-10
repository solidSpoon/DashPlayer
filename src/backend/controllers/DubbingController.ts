import { inject, injectable } from 'inversify';
import Controller from '@/backend/controllers/Controller';
import registerRoute from '@/backend/controllers/ipc/registerRoute';
import TYPES from '@/backend/ioc/types';
import DubbingService from '@/backend/services/DubbingService';

/**
 * 配音 IPC 控制器：注册 dubbing/* 路径，参数整理与转发到 DubbingService。
 */
@injectable()
export default class DubbingController implements Controller {
    @inject(TYPES.DubbingService)
    private dubbingService!: DubbingService;

    registerRoutes(): void {
        registerRoute('dubbing/save-take', (p) => this.dubbingService.saveTake(p));
        registerRoute('dubbing/list', (p) => this.dubbingService.list(p.videoKey));
        registerRoute('dubbing/list-library', () => this.dubbingService.listLibrary());
        registerRoute('dubbing/clear-sentence', (p) => this.dubbingService.clearSentence(p));
        registerRoute('dubbing/clear-video', (p) => this.dubbingService.clearVideo(p.videoKey));
        registerRoute('dubbing/export', (p) => this.dubbingService.exportDubbedVideo(p));
    }
}
