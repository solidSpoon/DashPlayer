import { app } from 'electron';

import { resetDatabaseFile } from '@/backend/infrastructure/db/db';
import { storeClear } from '@/backend/infrastructure/settings/store';

/** 重启指令发出前的延迟：给 IPC 响应与日志落盘留出时间。 */
const RELAUNCH_DELAY_MS = 300;

const relaunch = (): void => {
    setTimeout(() => {
        app.relaunch();
        app.exit(0);
    }, RELAUNCH_DELAY_MS);
};

/**
 * 重试：直接重启应用，下次启动从未完成的迁移继续执行。
 */
export const retryStartup = (): void => {
    relaunch();
};

/**
 * 重置用户数据并重启：删除本地数据库文件并清空全部持久化设置。
 *
 * 适用场景：迁移反复失败、常规重试无法自愈。有损操作——设置（含 API 密钥）
 * 与学习数据全部丢失；视频文件与已下载的模型资源不受影响。
 * 调用方（gate 页）必须先让用户显式确认。
 *
 * 权限说明：只触碰用户目录（userData）内的文件，无需提权；文件被占用
 * （如杀毒软件扫描、另一个实例）时抛错给 gate 页展示，用户处理后可重试。
 */
export const resetUserDataAndRelaunch = async (): Promise<void> => {
    await resetDatabaseFile();
    storeClear();
    relaunch();
};
