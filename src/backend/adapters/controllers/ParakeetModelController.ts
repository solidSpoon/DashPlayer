import { inject, injectable } from 'inversify';
import Controller from '@/backend/adapters/controllers/Controller';
import registerRoute from '@/backend/adapters/ipc/registerRoute';
import { ParakeetModelService } from '@/backend/application/services/impl/ParakeetModelService';
import TYPES from '@/backend/ioc/types';

/**
 * 暴露 Parakeet 本地模型管理 IPC。
 */
@injectable()
export class ParakeetModelController implements Controller {
    constructor(@inject(TYPES.ParakeetModelService) private readonly modelService: ParakeetModelService) {}

    /** 注册模型状态与下载路由。 */
    public registerRoutes(): void {
        registerRoute('parakeet/models/status', () => this.modelService.getStatus());
        registerRoute('parakeet/models/download', () => this.modelService.download());
    }
}
