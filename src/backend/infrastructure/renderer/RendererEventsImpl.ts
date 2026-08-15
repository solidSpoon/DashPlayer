import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import RendererEvents from '@/backend/services/gateways/renderer/RendererEvents';
import { RuntimeSettingKey } from '@/common/contracts/runtime-settings';
import { DpTask } from '@/common/contracts/dp-task';
import MainWindowRegistry from '@/backend/infrastructure/system/MainWindowRegistry';

@injectable()
export default class RendererEventsImpl implements RendererEvents {
    @inject(TYPES.MainWindowRegistry)
    private mainWindowRegistry!: MainWindowRegistry;

    private resolveWindow() {
        return this.mainWindowRegistry.tryGetMainWindow();
    }

    /**
     * 向渲染进程发送非敏感设置变化。
     *
     * @param key 运行时设置键。
     * @param value 设置值。
     */
    public storeUpdate(key: RuntimeSettingKey, value: string): void {
        const win = this.resolveWindow();
        if (!win || win.isDestroyed()) {
            return;
        }
        win.webContents.send('store-update', key, value);
    }

    /**
     * 向渲染进程发送后台任务状态变化。
     *
     * @param task 后台任务详情。
     */
    public dpTaskUpdate(task: DpTask): void {
        const win = this.resolveWindow();
        if (!win || win.isDestroyed()) {
            return;
        }
        win.webContents.send('dp-task-update', task);
    }

    public error(error: Error): void {
        const win = this.resolveWindow();
        if (!win || win.isDestroyed()) {
            return;
        }
        win.webContents.send('error-msg', error);
    }

    public info(message: string): void {
        const win = this.resolveWindow();
        if (!win || win.isDestroyed()) {
            return;
        }
        win.webContents.send('info-msg', message);
    }
}
