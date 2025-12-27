import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import SystemService from '@/backend/services/SystemService';
import RendererEvents from '@/backend/services/RendererEvents';
import { SettingKey } from '@/common/types/store_schema';
import { DpTask } from '@/backend/infrastructure/db/tables/dpTask';

@injectable()
export default class RendererEventsImpl implements RendererEvents {
    @inject(TYPES.SystemService)
    private systemService!: SystemService;

    private resolveWindow() {
        try {
            return this.systemService.mainWindow();
        } catch {
            return null;
        }
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
}

