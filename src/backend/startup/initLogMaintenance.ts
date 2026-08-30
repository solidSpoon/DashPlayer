import { pruneOldLogs, startUncaughtErrorLogging } from '@/backend/infrastructure/logger';

/**
 * 初始化日志系统的进程级生命周期：
 * - 挂上 main 未捕获异常的落盘兜底（必须尽早执行，晚于任何其他初始化）；
 * - 调度日志保留期与目录预算清理。短时会话可能活不到下一个 24 小时周期，因此启动后先跑一次。
 */
export function initLogMaintenance(): void {
    startUncaughtErrorLogging();
    setTimeout(() => pruneOldLogs(), 60 * 1000).unref();
    setInterval(() => pruneOldLogs(), 24 * 60 * 60 * 1000).unref();
}
