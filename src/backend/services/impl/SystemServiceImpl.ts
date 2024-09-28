import { WindowState } from '@/common/types/Types';
import { injectable, postConstruct } from 'inversify';
import SystemService from '@/backend/services/SystemService';
import { BrowserWindow } from 'electron';
import PathUtil from '@/common/utils/PathUtil';
import path from 'path';
import { TypeGuards } from '@/backend/utils/TypeGuards';

@injectable()
export default class SystemServiceImpl implements SystemService {
    public mainWindowRef: { current: BrowserWindow | null } = { current: null };

    public mainWindow() {
        const current = this.mainWindowRef.current;
        TypeGuards.assertNotNull(current, 'mainWindow is null');
        return current;
    }

    public setMainWindow(mainWindowRef: { current: BrowserWindow | null }) {
        this.mainWindowRef = mainWindowRef;
    }

    public changeWindowSize(state: WindowState) {
        switch (state) {
            case 'normal':
                this.mainWindow()?.unmaximize();
                this.mainWindow()?.setFullScreen(false);
                break;
            case 'maximized':
                this.mainWindow()?.maximize();
                break;
            case 'minimized':
                this.mainWindow()?.minimize();
                break;
            case 'fullscreen':
                this.mainWindow()?.setFullScreen(true);
                break;
            case 'closed':
                this.mainWindow()?.close();
                break;
            case 'home':
                this.mainWindow()?.unmaximize();
                this.mainWindow()?.setSize(1200, 800);
                this.mainWindow()?.setResizable(false);
                this.mainWindow()?.setMaximizable(false);
                break;
            case 'player':
                this.mainWindow()?.setResizable(true);
                this.mainWindow()?.setMaximizable(true);
                this.mainWindow()?.maximize();
                break;
            default:
                break;
        }
    }

    public windowState(): WindowState {
        if (this.mainWindow().isMaximized()) {
            return 'maximized';
        } else if (this.mainWindow().isMinimized()) {
            return 'minimized';
        } else if (this.mainWindow().isFullScreen()) {
            return 'fullscreen';
        } else {
            return 'normal';
        }
    }

    public isWindows() {
        return process.platform === 'win32';
    }

    public sendErrorToRenderer(error: Error) {
        this.mainWindow()?.webContents.send('error-msg', error);
    }

    @postConstruct()
    init() {
        PathUtil.SEPARATOR = path.sep;
    }
}
