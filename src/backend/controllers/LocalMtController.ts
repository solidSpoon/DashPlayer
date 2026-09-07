import { inject, injectable } from 'inversify';
import type Controller from '@/backend/controllers/Controller';
import registerRoute from '@/backend/controllers/ipc/registerRoute';
import type LocalMtService from '@/backend/services/LocalMtService';
import TYPES from '@/backend/ioc/types';

/** 提供轻量翻译模型的设置页管理与状态查询。 */
@injectable()
export class LocalMtController implements Controller {
    /** 注入轻量翻译模型服务。 */
    public constructor(@inject(TYPES.LocalMtService) private readonly localMt: LocalMtService) {}

    /** 注册状态、下载、取消与删除路由。 */
    public registerRoutes(): void {
        registerRoute('local-mt/status', () => this.localMt.getStatus());
        registerRoute('local-mt/download', () => this.localMt.download());
        registerRoute('local-mt/cancel-download', () => this.localMt.cancelDownload());
        registerRoute('local-mt/delete', () => this.localMt.deleteModel());
    }
}
