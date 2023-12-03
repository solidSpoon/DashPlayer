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
import { WindowState } from '../types/Types';
import migration from '../db/migration';
import runMigrate from "../db2/migrate";

const { net, protocol } = require('electron');

class AppUpdater {
    constructor() {
        log.transports.file.level = 'info';
        autoUpdater.logger = log;
        autoUpdater.checkForUpdatesAndNotify();
    }
}
const events = [
    'maximize',
    'unmaximize',
    'enter-full-screen',
    'leave-full-screen',
    'minimize',
    'restore',
];
const windowStateChange = (w: BrowserWindow) => {
    let targetState: WindowState = 'closed';
    if (w?.isMaximized?.()) {
        targetState = 'maximized';
    }
    if (w?.isMinimized?.()) {
        targetState = 'minimized';
    }
    if (w?.isFullScreen?.()) {
        targetState = 'fullscreen';
    }
    if (w?.isNormal?.()) {
        targetState = 'normal';
    }
    console.log('mainWindowStateChange', targetState);
    return targetState;
};
// eslint-disable-next-line import/no-mutable-exports
export let mainWindow: BrowserWindow | null = null;
// eslint-disable-next-line import/no-mutable-exports
export let settingWindow: BrowserWindow | null = null;
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
        width: 800,
        height: 600,
        show: false,
        icon: getAssetPath('icon.png'),
        webPreferences: {
            preload: app.isPackaged
                ? path.join(__dirname, 'preload.js')
                : path.join(__dirname, '../../.erb/dll/preload.js'),
        },
        resizable: false,
        maximizable: false,
        // titleBarStyle: 'hidden',
        frame: false,
    });
    // mainWindow.maximize();
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
        settingWindow?.close();
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
        mainWindow?.webContents.send('fullscreen');
    });
    mainWindow?.on('leave-full-screen', () => {
        mainWindow?.setWindowButtonVisibility?.(false);
        if (mainWindow?.isMaximized()) {
            mainWindow?.webContents.send('maximize');
        } else {
            mainWindow?.webContents.send('unmaximize');
        }
    });
    events.forEach((event) => {
        // @ts-ignore
        mainWindow?.on(event, () => {
            mainWindow?.webContents.send(
                'main-state',
                windowStateChange(mainWindow)
            );
        });
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
        resizable: false,
        show: false,
        icon: getAssetPath('icon.png'),
        alwaysOnTop: true,
        webPreferences: {
            preload: app.isPackaged
                ? path.join(__dirname, 'preload.js')
                : path.join(__dirname, '../../.erb/dll/preload.js'),
        },
        titleBarStyle: 'hidden',
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
    events.forEach((event) => {
        // @ts-ignore
        settingWindow?.on(event, () => {
            settingWindow?.webContents.send(
                'setting-state',
                windowStateChange(settingWindow)
            );
        });
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
        protocol.registerFileProtocol('dp', (request, callback) => {
            const url: string = request.url.replace('dp:///', '');
            try {
                return callback(decodeURIComponent(url));
            } catch (error) {
                console.error(error);
                return callback('');
            }
        });
    })
    .catch(console.log);

runMigrate();
