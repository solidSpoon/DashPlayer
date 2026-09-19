import { inject, injectable } from 'inversify';
import Controller from '@/backend/controllers/Controller';
import registerRoute from '@/backend/controllers/ipc/registerRoute';
import ParakeetModelService from '@/backend/services/ParakeetModelService';
import TYPES from '@/backend/ioc/types';

/**
 * 暴露 Parakeet 本地模型管理 IPC。
 */
@injectable()
export class ParakeetModelController implements Controller {
    constructor(@inject(TYPES.ParakeetModelService) private readonly modelService: ParakeetModelService) {}

    /** 注册模型状态、下载、取消下载与删除路由。 */
    public registerRoutes(): void {
        registerRoute('parakeet/models/status', (params) => this.modelService.getStatus(params?.model));
        registerRoute('parakeet/models/download', (params) => this.modelService.download(params?.model));
        registerRoute('parakeet/models/cancel-download', (params) => this.modelService.cancelDownload(params?.model));
        registerRoute('parakeet/models/delete', (params) => this.modelService.deleteModel(params?.model));
    }
}
