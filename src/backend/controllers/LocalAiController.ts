import { inject, injectable } from 'inversify';
import type Controller from '@/backend/controllers/Controller';
import registerRoute from '@/backend/controllers/ipc/registerRoute';
import type LocalAiService from '@/backend/services/LocalAiService';
import TYPES from '@/backend/ioc/types';

/** 提供本地模型的设置页管理与实际推理检查。 */
@injectable()
export class LocalAiController implements Controller {
    /** 注入统一的模型管理与推理服务。 */
    public constructor(@inject(TYPES.LocalAiService) private readonly localAi: LocalAiService) {}

    /** 注册状态、下载、取消、删除、切换使用模型和生成检查路由。 */
    public registerRoutes(): void {
        registerRoute('local-ai/status', () => this.localAi.getStatus());
        registerRoute('local-ai/use', ({ modelId }) => this.localAi.setActiveModelId(modelId));
        registerRoute('local-ai/download', ({ modelId }) => this.localAi.download(modelId));
        registerRoute('local-ai/cancel-download', () => this.localAi.cancelDownload());
        registerRoute('local-ai/delete', ({ modelId }) => this.localAi.deleteModel(modelId));
        registerRoute('local-ai/speed-test', ({ modelId }) => this.localAi.speedTest(modelId));
    }
}
