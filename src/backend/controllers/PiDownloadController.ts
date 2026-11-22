import { inject, injectable } from 'inversify';
import type Controller from '@/backend/controllers/Controller';
import registerRoute from '@/backend/controllers/ipc/registerRoute';
import TYPES from '@/backend/ioc/types';
import type PiDownloadService from '@/backend/services/PiDownloadService';

/**
 * Pi 下载 Agent 会话 IPC 控制器。
 */
@injectable()
export default class PiDownloadController implements Controller {
    constructor(
        @inject(TYPES.PiDownloadService) private readonly piDownloadService: PiDownloadService,
    ) {}

    /**
     * 注册 Pi 下载会话启动、发消息、中止、关闭、详情与历史列表路由。
     */
    public registerRoutes(): void {
        registerRoute('pi-download/start', (req) => this.piDownloadService.startDownload(req.url, req.outputDir));
        registerRoute('pi-download/send-message', (req) => this.piDownloadService.sendMessage(req.sessionId, req.message));
        registerRoute('pi-download/abort', (req) => this.piDownloadService.abort(req.sessionId));
        registerRoute('pi-download/close', (req) => this.piDownloadService.close(req.sessionId));
        registerRoute('pi-download/list-sessions', () => this.piDownloadService.listSessions());
        registerRoute('pi-download/get-session', (req) => this.piDownloadService.getSession(req.sessionId));
        registerRoute('pi-download/delete-session', (req) => this.piDownloadService.deleteSession(req.sessionId));
        registerRoute('pi-download/context', () => this.piDownloadService.getContext());
    }
}
