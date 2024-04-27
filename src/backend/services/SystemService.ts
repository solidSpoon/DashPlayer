import {WindowState} from "@/common/types/Types";

export default class SystemService {
    public static mainWindowRef: Electron.CrossProcessExports.BrowserWindow;

    public static changeWindowSize(state: WindowState) {
        switch (state) {
            case 'normal':
                SystemService.mainWindowRef?.unmaximize();
                SystemService.mainWindowRef?.setFullScreen(false);
                break;
            case 'maximized':
                SystemService.mainWindowRef?.maximize();
                break;
            case 'minimized':
                SystemService.mainWindowRef?.minimize();
                break;
            case 'fullscreen':
                SystemService.mainWindowRef?.setFullScreen(true);
                break;
            case 'closed':
                SystemService.mainWindowRef?.close();
                break;
            case 'home':
                SystemService.mainWindowRef?.unmaximize();
                SystemService.mainWindowRef?.setSize(1200, 800);
                SystemService.mainWindowRef?.setResizable(false);
                SystemService.mainWindowRef?.setMaximizable(false);
                break;
            case "player":
                SystemService.mainWindowRef?.setResizable(true);
                SystemService.mainWindowRef?.setMaximizable(true);
                SystemService.mainWindowRef?.maximize();
                break;
            default:
                break;
        }
    }
}
