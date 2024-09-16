import { WindowState } from '@/common/types/Types';
import { BrowserWindow } from 'electron';

/**
 * SystemService
 */
export default interface SystemService {

    changeWindowSize(state: WindowState): void;

    windowState(): WindowState;

    isWindows(): boolean;

    sendErrorToRenderer(error: Error): void;

    mainWindow(): Electron.BrowserWindow;

    setMainWindow(mainWindowRef: { current: BrowserWindow | null }): void;
}
