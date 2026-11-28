import { inject, injectable } from 'inversify';
import type Controller from '@/backend/controllers/Controller';
import registerRoute from '@/backend/controllers/ipc/registerRoute';
import TYPES from '@/backend/ioc/types';
import type PiRuntimeService from '@/backend/services/PiRuntimeService';

/**
 * Pi 二进制运行环境 IPC 控制器。
 */
@injectable()
export default class PiRuntimeController implements Controller {
    constructor(
        @inject(TYPES.PiRuntimeService) private readonly piRuntimeService: PiRuntimeService,
    ) {}

    /**
     * 注册 Pi 运行环境状态、下载、取消下载与卸载路由。
     */
    public registerRoutes(): void {
        registerRoute('pi-runtime/status', () => this.piRuntimeService.getStatus());
        registerRoute('pi-runtime/download', () => this.piRuntimeService.download());
        registerRoute('pi-runtime/cancel-download', async () => {
            this.piRuntimeService.cancelDownload();
        });
        registerRoute('pi-runtime/remove', () => this.piRuntimeService.remove());
    }
}
