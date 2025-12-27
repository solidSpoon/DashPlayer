import { BrowserWindow } from 'electron';

export default interface MainWindowRegistry {
    setMainWindowRef(mainWindowRef: { current: BrowserWindow | null }): void;
    tryGetMainWindow(): BrowserWindow | null;
    getMainWindow(): BrowserWindow;
}

