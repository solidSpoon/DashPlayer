import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import RendererEvents from '@/backend/application/ports/gateways/renderer/RendererEvents';
import { SettingKey } from '@/common/types/store_schema';
import { DpTask } from '@/backend/infrastructure/db/tables/dpTask';
import MainWindowRegistry from '@/backend/infrastructure/system/MainWindowRegistry';

@injectable()
export default class RendererEventsImpl implements RendererEvents {
    @inject(TYPES.MainWindowRegistry)
    private mainWindowRegistry!: MainWindowRegistry;

    private resolveWindow() {
        return this.mainWindowRegistry.tryGetMainWindow();
    }

    public storeUpdate(key: SettingKey, value: string): void {
        const win = this.resolveWindow();
        if (!win || win.isDestroyed()) {
            return;
        }
        win.webContents.send('store-update', key, value);
    }

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
