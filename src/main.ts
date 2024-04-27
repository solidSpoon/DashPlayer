import { app, BrowserWindow, protocol, net } from 'electron';
import path from 'path';
import registerHandler from '@/backend/dispatcher';
import runMigrate from '@/backend/db/migrate';
import SystemService from '@/backend/services/SystemService';
import { DP_LOCAL, DP_NET } from '@/common/utils/UrlUtil';
import url from 'url';
import axios from 'axios';
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    app.quit();
}
const mainWindowRef = {
    current: null as BrowserWindow | null
};
const createWindow = () => {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        },
        frame: false,
        titleBarStyle: 'customButtonsOnHover'
    });
    mainWindowRef.current = mainWindow;
    SystemService.mainWindowRef = mainWindow;
    // and load the index.html of the app.
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
        // Open the DevTools.
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
    }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
protocol.registerSchemesAsPrivileged([
    {
        scheme: DP_LOCAL,
        privileges: {
            standard: true,
            secure: true,
            bypassCSP: true,
            allowServiceWorkers: true,
            supportFetchAPI: true,
            stream: true,
            codeCache: true,
            corsEnabled: true
        }
    }
]);
protocol.registerSchemesAsPrivileged([
    {
        scheme: DP_NET,
        privileges: {
            standard: true,
            secure: true,
            bypassCSP: true,
            allowServiceWorkers: true,
            supportFetchAPI: true,
            stream: true,
            codeCache: true,
            corsEnabled: false
        }
    }
]);
app.on('ready', async () => {
    await runMigrate();
    createWindow();
    protocol.registerFileProtocol(DP_LOCAL, (request, callback) => {
        const url: string = request.url.replace(`${DP_LOCAL}://`, '');
        try {
            return callback(decodeURIComponent(url));
        } catch (error) {
            console.error(error);
            return callback('');
        }
    });
    // protocol.handle(DP_LOCAL, (request) => {
    //     const path1: string = 'file:///' + request.url.slice(`${DP_LOCAL}://`.length);
    //     console.log('path1', path1);
    //     return net.fetch(path1);
    // });
    protocol.handle(DP_NET, (request) => {
        const url = request.url
            .replace(`${DP_NET}://`, '')
            .replace('https//', 'https://');
        return net.fetch(url);
    });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
registerHandler(mainWindowRef);
app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
