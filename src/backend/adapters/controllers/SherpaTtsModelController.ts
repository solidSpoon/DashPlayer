import { inject, injectable } from 'inversify';
import Controller from '@/backend/adapters/controllers/Controller';
import registerRoute from '@/backend/adapters/ipc/registerRoute';
import TYPES from '@/backend/ioc/types';
import { SherpaTtsModelService } from '@/backend/application/services/impl/SherpaTtsModelService';

/**
 * 暴露 Sherpa TTS 模型管理 IPC。
 */
@injectable()
export class SherpaTtsModelController implements Controller {
    constructor(@inject(TYPES.SherpaTtsModelService) private readonly modelService: SherpaTtsModelService) {}

    /** 注册模型状态、下载、取消下载与删除路由。 */
    public registerRoutes(): void {
        registerRoute('sherpa-tts/models/status', () => this.modelService.getStatus());
        registerRoute('sherpa-tts/models/download', () => this.modelService.download());
        registerRoute('sherpa-tts/models/cancel-download', () => this.modelService.cancelDownload());
        registerRoute('sherpa-tts/models/delete', () => this.modelService.deleteModel());
    }
}
