import { injectable } from 'inversify';
import { BrowserWindow } from 'electron';
import MainWindowRegistry from '@/backend/infrastructure/system/MainWindowRegistry';
import { TypeGuards } from '@/backend/utils/TypeGuards';

@injectable()
export default class MainWindowRegistryImpl implements MainWindowRegistry {
    private mainWindowRef: { current: BrowserWindow | null } = { current: null };

    public setMainWindowRef(mainWindowRef: { current: BrowserWindow | null }): void {
        this.mainWindowRef = mainWindowRef;
    }

    public tryGetMainWindow(): BrowserWindow | null {
        const win = this.mainWindowRef.current;
        if (!win || win.isDestroyed()) {
            return null;
        }
        return win;
    }

    public getMainWindow(): BrowserWindow {
        const win = this.tryGetMainWindow();
        TypeGuards.assertNotNull(win, 'mainWindow is null');
        return win;
    }
}

