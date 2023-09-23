/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import { app, BrowserWindow, shell, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
// eslint-disable-next-line import/no-cycle
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import registerHandler from './IpcHandler';

class AppUpdater {
    constructor() {
        log.transports.file.level = 'info';
        autoUpdater.logger = log;
        autoUpdater.checkForUpdatesAndNotify();
    }
}

let mainWindow: BrowserWindow | null = null;
let settingWindow: BrowserWindow | null = null;
ipcMain.on('ipc-example', async (event, arg) => {
    const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
    console.log(msgTemplate(arg));
    event.reply('ipc-example', msgTemplate('pong'));
});
registerHandler();
if (process.env.NODE_ENV === 'production') {
    const sourceMapSupport = require('source-map-support');
    sourceMapSupport.install();
}

const isDebug =
    process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
    require('electron-debug')();
}

const installExtensions = async () => {
    const installer = require('electron-devtools-installer');
    const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
    const extensions = ['REACT_DEVELOPER_TOOLS'];

    return installer
        .default(
            extensions.map((name) => installer[name]),
            forceDownload
        )
        .catch(console.log);
};

export const createPlayerWindow = async () => {
    if (isDebug) {
        await installExtensions();
    }

    const RESOURCES_PATH = app.isPackaged
        ? path.join(process.resourcesPath, 'assets')
        : path.join(__dirname, '../../assets');

    const getAssetPath = (...paths: string[]): string => {
        return path.join(RESOURCES_PATH, ...paths);
    };

    mainWindow = new BrowserWindow({
        show: false,
        icon: getAssetPath('icon.png'),
        webPreferences: {
            preload: app.isPackaged
                ? path.join(__dirname, 'preload.js')
                : path.join(__dirname, '../../.erb/dll/preload.js'),
        },
        resizable: true,
        // titleBarStyle: 'hidden',
        frame: false,
    });
    mainWindow.maximize();
    mainWindow.loadURL(resolveHtmlPath('player.html'));

    mainWindow.on('ready-to-show', () => {
        if (!mainWindow) {
            throw new Error('"mainWindow" is not defined');
        }
        if (process.env.START_MINIMIZED) {
            mainWindow.minimize();
        } else {
            mainWindow.show();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    const menuBuilder = new MenuBuilder(mainWindow);
    menuBuilder.buildMenu();

    // Open urls in the user's browser
    mainWindow.webContents.setWindowOpenHandler((edata) => {
        shell.openExternal(edata.url);
        return { action: 'deny' };
    });

    // on full screen, show button
    mainWindow?.on('enter-full-screen', () => {
        mainWindow?.setWindowButtonVisibility(true);
    });
    mainWindow?.on('leave-full-screen', () => {
        mainWindow?.setWindowButtonVisibility(false);
    });
    // Remove this if your app does not use auto updates
    // eslint-disable-next-line
    // new AppUpdater();
};
const createSettingWindow = async () => {
    if (isDebug) {
        await installExtensions();
    }

    const RESOURCES_PATH = app.isPackaged
        ? path.join(process.resourcesPath, 'assets')
        : path.join(__dirname, '../../assets');

    const getAssetPath = (...paths: string[]): string => {
        return path.join(RESOURCES_PATH, ...paths);
    };

    settingWindow = new BrowserWindow({
        width: 800,
        height: 500,
        show: false,
        icon: getAssetPath('icon.png'),
        alwaysOnTop: true,
        webPreferences: {
            preload: app.isPackaged
                ? path.join(__dirname, 'preload.js')
                : path.join(__dirname, '../../.erb/dll/preload.js'),
        },
        frame: process.platform === 'darwin',
    });
    settingWindow.loadURL(resolveHtmlPath('setting.html'));

    settingWindow.on('ready-to-show', () => {
        if (!settingWindow) {
            throw new Error('"mainWindow" is not defined');
        }
        if (process.env.START_MINIMIZED) {
            settingWindow.minimize();
        } else {
            settingWindow.show();
        }
    });

    settingWindow.on('closed', () => {
        settingWindow = null;
    });

    const menuBuilder = new MenuBuilder(settingWindow);
    menuBuilder.buildMenu();

    // Open urls in the user's browser
    settingWindow.webContents.setWindowOpenHandler((edata) => {
        shell.openExternal(edata.url);
        return { action: 'deny' };
    });

    // Remove this if your app does not use auto updates
    // eslint-disable-next-line
    // new AppUpdater();
};
export const createSettingWindowIfNeed = async () => {
    if (settingWindow === null) await createSettingWindow();
};
/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
    // Respect the OSX convention of having the application in memory even
    // after all windows have been closed
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.whenReady()
    .then(() => {
        createPlayerWindow();
        app.on('activate', () => {
            // On macOS it's common to re-create a window in the app when the
            // dock icon is clicked and there are no other windows open.
            if (mainWindow === null) createPlayerWindow();
        });
    })
    .catch(console.log);

ipcMain.on('maximize', async (event) => {
    log.info('maximize');
    mainWindow?.maximize();
    event.reply('maximize', 'success');
});
ipcMain.on('unmaximize', async (event) => {
    log.info('unmaximize');
    mainWindow?.unmaximize();
    event.reply('unmaximize', 'success');
});
ipcMain.on('is-maximized', async (event) => {
    log.info('is-maximized');
    event.reply('is-maximized', mainWindow?.isMaximized());
});
ipcMain.on('is-full-screen', async (event) => {
    log.info('is-full-screen');
    event.reply('is-full-screen', mainWindow?.isFullScreen());
});
ipcMain.on('show-button', async (event) => {
    log.info('show-button');
    // 展示红绿灯
    if (process.platform === 'darwin') {
        mainWindow?.setWindowButtonVisibility(true);
    }
    event.reply('show-button', 'success');
});
ipcMain.on('hide-button', async (event) => {
    log.info('hide-button');
    // 隐藏红绿灯
    if (process.platform === 'darwin') {
        mainWindow?.setWindowButtonVisibility(false);
    }

    event.reply('hide-button', 'success');
});
ipcMain.on('minimize', async (event) => {
    log.info('minimize');
    mainWindow?.minimize();
    event.reply('minimize', 'success');
});
ipcMain.on('close', async (event) => {
    log.info('close');
    mainWindow?.close();
    event.reply('close', 'success');
});
ipcMain.on('open-menu', async (event) => {
    log.info('open-menu');
    // create or show setting window
    await createSettingWindowIfNeed();
    settingWindow?.show();
    event.reply('open-menu', 'success');
});
