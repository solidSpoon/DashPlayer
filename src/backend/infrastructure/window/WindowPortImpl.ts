import { inject, injectable } from 'inversify';
import WindowPort from '@/backend/application/ports/gateways/window/WindowPort';
import TYPES from '@/backend/ioc/types';
import MainWindowRegistry from '@/backend/infrastructure/system/MainWindowRegistry';
import { WindowState } from '@/common/types/Types';

@injectable()
export default class WindowPortImpl implements WindowPort {
    @inject(TYPES.MainWindowRegistry)
    private mainWindowRegistry!: MainWindowRegistry;

    private tryGetWindow() {
        return this.mainWindowRegistry.tryGetMainWindow();
    }

    public changeWindowSize(state: WindowState): void {
        const win = this.tryGetWindow();
        if (!win) {
            return;
        }

        switch (state) {
            case 'normal':
                win.unmaximize();
                win.setFullScreen(false);
                break;
            case 'maximized':
                win.maximize();
                break;
            case 'minimized':
                win.minimize();
                break;
            case 'fullscreen':
                win.setFullScreen(true);
                break;
            case 'closed':
                win.close();
                break;
            case 'home':
                win.unmaximize();
                win.setSize(1200, 800);
                win.setResizable(false);
                win.setMaximizable(false);
                break;
            case 'player':
                win.setResizable(true);
                win.setMaximizable(true);
                win.maximize();
                break;
            default:
                break;
        }
    }

    public windowState(): WindowState {
        const win = this.mainWindowRegistry.getMainWindow();
        if (win.isMaximized()) {
            return 'maximized';
        } else if (win.isMinimized()) {
            return 'minimized';
        } else if (win.isFullScreen()) {
            return 'fullscreen';
        } else {
            return 'normal';
        }
    }

    public setWindowButtonsVisible(visible: boolean): void {
        const win = this.tryGetWindow();
        if (!win) {
            return;
        }
        if (process.platform !== 'darwin') {
            return;
        }
        win.setWindowButtonVisibility(visible);
    }
}

