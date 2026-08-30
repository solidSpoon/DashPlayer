import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import RendererEvents from '@/backend/services/gateways/renderer/RendererEvents';
import { RuntimeSettingKey } from '@/common/contracts/runtime-settings';
import { DpTask, DpTaskState } from '@/common/contracts/dp-task';
import MainWindowRegistry from '@/backend/infrastructure/system/MainWindowRegistry';
import { getMainLogger } from '@/backend/infrastructure/logger';

const logger = getMainLogger('RendererEvents');

/** 同一通道"事件被丢弃"告警的最小间隔（毫秒），避免窗口销毁后持续推送刷满日志。 */
const DROP_WARN_INTERVAL_MS = 5000;

@injectable()
export default class RendererEventsImpl implements RendererEvents {
    @inject(TYPES.MainWindowRegistry)
    private mainWindowRegistry!: MainWindowRegistry;

    /** 各通道上次记录"丢弃"告警的时间戳。 */
    private readonly lastDropWarnAt = new Map<string, number>();

    /** 各任务上次推送给渲染进程的状态，用来只在状态跃迁时记日志。 */
    private readonly lastPushedStatus = new Map<number, DpTaskState>();

    /**
     * 解析可用的主窗口；不可用时显式记录丢弃原因。
     *
     * @param channel 事件通道名，用于日志归因。
     * @returns 可用时返回主窗口，否则返回 null。
     */
    private resolveWindow(channel: string) {
        const win = this.mainWindowRegistry.tryGetMainWindow();
        if (!win) {
            this.warnDropped(channel, 'no main window');
            return null;
        }
        if (win.isDestroyed()) {
            this.warnDropped(channel, 'main window destroyed');
            return null;
        }
        return win;
    }

    /**
     * 按通道节流记录事件被丢弃；不静默吞掉，也不让高频推送打爆日志配额。
     *
     * @param channel 事件通道名。
     * @param reason 丢弃原因。
     */
    private warnDropped(channel: string, reason: string): void {
        const now = Date.now();
        const lastAt = this.lastDropWarnAt.get(channel) ?? 0;
        if (now - lastAt < DROP_WARN_INTERVAL_MS) {
            return;
        }
        this.lastDropWarnAt.set(channel, now);
        logger.warn('renderer event dropped', { channel, reason });
    }

    /**
     * 向渲染进程发送非敏感设置变化。
     *
     * @param key 运行时设置键。
     * @param value 设置值。
     */
    public storeUpdate(key: RuntimeSettingKey, value: string): void {
        const win = this.resolveWindow('store-update');
        if (!win) {
            return;
        }
        logger.debug('renderer event sent', { channel: 'store-update', key });
        win.webContents.send('store-update', key, value);
    }

    /**
     * 向渲染进程发送后台任务状态变化。
     *
     * 任务进度更新本身是高频事件，因此只在状态跃迁（含首次推送）时记 info，
     * 保证"任务何时进入 done/failed/cancelled"在日志里留下明确时间点。
     *
     * @param task 后台任务详情。
     */
    public dpTaskUpdate(task: DpTask): void {
        const win = this.resolveWindow('dp-task-update');
        if (!win) {
            return;
        }
        const previous = this.lastPushedStatus.get(task.id);
        if (previous !== task.status) {
            this.lastPushedStatus.set(task.id, task.status);
            logger.info('task status pushed to renderer', {
                taskId: task.id,
                from: previous ?? null,
                to: task.status,
            });
            // 终态之后不会再有跃迁，及时释放条目避免长会话堆积。
            if (
                task.status === DpTaskState.DONE
                || task.status === DpTaskState.FAILED
                || task.status === DpTaskState.CANCELLED
            ) {
                this.lastPushedStatus.delete(task.id);
            }
        }
        win.webContents.send('dp-task-update', task);
    }

    /**
     * 向渲染进程推送错误提示。
     *
     * @param error 需要展示的错误。
     */
    public error(error: Error): void {
        const win = this.resolveWindow('error-msg');
        if (!win) {
            return;
        }
        logger.warn('renderer error toast sent', { message: error.message });
        win.webContents.send('error-msg', error);
    }

    /**
     * 向渲染进程推送信息提示。
     *
     * @param message 提示文本。
     */
    public info(message: string): void {
        const win = this.resolveWindow('info-msg');
        if (!win) {
            return;
        }
        logger.info('renderer info toast sent', { message });
        win.webContents.send('info-msg', message);
    }
}
