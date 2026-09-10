import { injectable } from 'inversify';
import registerRoute from '@/backend/controllers/ipc/registerRoute';
import Controller from '@/backend/controllers/Controller';
import { getMainLogger } from '@/backend/infrastructure/logger';
import { getMigrationFailure } from '@/backend/startup/migrationFailureState';
import { resetUserDataAndRelaunch, retryStartup } from '@/backend/startup/migrationRecovery';
import type { MigrationFailureDetail } from '@/common/contracts/migration-failure';

/**
 * 迁移失败恢复路由。
 *
 * 两种模式下都会注册：
 * - 正常模式：detail 返回 failed=false，前端据此直接进入主界面；
 * - 恢复模式（迁移失败）：这是唯一注册的业务路由组，前端只渲染恢复 gate 页。
 * 控制器刻意不依赖数据库——恢复模式下数据库可能处于不可用状态。
 */
@injectable()
export default class MigrationFailureController implements Controller {
    private readonly logger = getMainLogger('MigrationFailure');

    registerRoutes(): void {
        registerRoute('migration-failure/detail', async () => this.detail());
        registerRoute('migration-failure/retry', async () => this.retry());
        registerRoute('migration-failure/reset-and-relaunch', () => this.resetAndRelaunch());
    }

    /**
     * 读取本次启动的迁移失败状态。
     *
     * @returns failed 为 false 表示迁移全部成功，前端直接进入主界面。
     */
    private async detail(): Promise<MigrationFailureDetail> {
        const failure = getMigrationFailure();
        return {
            failed: failure !== null,
            phase: failure?.phase ?? null,
            migrationId: failure?.migrationId ?? null,
            description: failure?.description ?? null,
            errorMessage: failure?.errorMessage ?? null,
        };
    }

    /** 重启应用；下次启动从未完成的迁移重试。 */
    private async retry(): Promise<void> {
        this.logger.warn('user requested retry, relaunching app');
        retryStartup();
    }

    /**
     * 重置用户数据并重启。
     *
     * @throws 重置过程中的任何错误（文件被占用、无写权限等）原样上抛，
     * 由 IPC 层转发给渲染端展示；不重启，用户处理后可再次尝试。
     */
    private async resetAndRelaunch(): Promise<void> {
        this.logger.warn('user requested reset-and-relaunch, wiping user data');
        await resetUserDataAndRelaunch();
    }
}
