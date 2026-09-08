import { inject, injectable } from 'inversify';
import Controller from '@/backend/controllers/Controller';
import registerRoute from '@/backend/controllers/ipc/registerRoute';
import WhisperCppModelService from '@/backend/services/WhisperCppModelService';
import TYPES from '@/backend/ioc/types';

/**
 * 暴露 whisper.cpp 本地模型管理 IPC。
 */
@injectable()
export default class WhisperCppModelController implements Controller {
    constructor(@inject(TYPES.WhisperCppModelService) private readonly modelService: WhisperCppModelService) {}

    /** 注册模型状态、下载、取消下载与删除路由。 */
    public registerRoutes(): void {
        registerRoute('whisper-cpp/models/status', () => this.modelService.getStatus());
        registerRoute('whisper-cpp/models/download', () => this.modelService.download());
        registerRoute('whisper-cpp/models/cancel-download', () => this.modelService.cancelDownload());
        registerRoute('whisper-cpp/models/delete', () => this.modelService.deleteModel());
    }
}
