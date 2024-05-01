import {WindowState} from "@/common/types/Types";
import fs from "fs";
import { dialog } from 'electron';
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

    public static windowState(): WindowState {
        if (SystemService.mainWindowRef.isMaximized()) {
            return 'maximized';
        } else if (SystemService.mainWindowRef.isMinimized()) {
            return 'minimized';
        } else if (SystemService.mainWindowRef.isFullScreen()) {
            return 'fullscreen';
        } else {
            return 'normal';
        }
    }

    public static isWindows() {
        return process.platform === 'win32';
    }
    public static sendErrorToRenderer(error: Error) {
        SystemService.mainWindowRef?.webContents.send('error-msg', error);
    }
    public static async read(path: string) {
        try {
            if (!fs.existsSync(path)) {
                return null;
            }
            return fs.readFileSync(path, 'utf-8');
        } catch (e) {
            // show open dialog
            await dialog.showMessageBox({
                type: 'error',
                message: `无权限读取文件，请选择文件 ${path} 来授权`,
            });

            const files = await dialog.showOpenDialog({
                properties: ['openFile'],
            });
            if (files.canceled) {
                return null;
            }
            return fs.readFileSync(path, 'utf-8');
        }
    }

    /**
     * 获取文件夹下的所有文件
     */
    public static async listFiles(path: string) {
        try {
            if (!fs.existsSync(path)) {
                return [];
            }
            return fs.readdirSync(path);
        } catch (e) {
            // show open dialog
            await dialog.showMessageBox({
                type: 'error',
                message: `无权限访问文件夹，请选择文件夹 ${path} 来授权`,
            });

            const files = await dialog.showOpenDialog({
                properties: ['openDirectory'],
            });
            if (files.canceled) {
                return [];
            }
            return fs.readdirSync(path);
        }
    }
}
