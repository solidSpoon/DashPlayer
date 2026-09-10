import { backendClient } from '@/fronted/infrastructure/electron/backendClient';
import type { MigrationFailureDetail } from '@/common/contracts/migration-failure';

/**
 * 读取本次启动的迁移失败状态。
 *
 * @returns failed 为 false 表示迁移全部成功，可直接进入主界面。
 */
export const getMigrationFailureDetail = (): Promise<MigrationFailureDetail> =>
    backendClient.call('migration-failure/detail');

/**
 * 重启应用以重试迁移。
 *
 * 后端会延迟数百毫秒退出，本 Promise 通常等不到返回；页面应保持重启中的
 * 展示状态，直到窗口被销毁。
 */
export const retryAfterMigrationFailure = (): Promise<void> =>
    backendClient.call('migration-failure/retry');

/**
 * 重置用户数据并重启（有损，调用前必须经用户确认）。
 *
 * @throws 重置失败（文件被占用、无写权限等）时拒绝，由页面展示错误。
 */
export const resetAndRelaunch = (): Promise<void> =>
    backendClient.call('migration-failure/reset-and-relaunch');
