import { app, BrowserWindow, protocol, net } from 'electron';
import path from 'path';
import registerHandler from '@/backend/dispatcher';
import runMigrate from '@/backend/db/migrate';
import SystemService from '@/backend/services/SystemService';
import { DP_FILE, DP } from '@/common/utils/UrlUtil';
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
        scheme: DP,
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
    protocol.registerFileProtocol(DP_FILE, (request, callback) => {
        const url: string = request.url.replace(`${DP_FILE}://`, '');
        try {
            return callback(decodeURIComponent(url));
        } catch (error) {
            console.error(error);
            return callback('');
        }
    });
    protocol.handle(DP, (request) => {
        let url = request.url.replace(`${DP}://`, '');
        if (url.startsWith('http')) {
             url = url
                .replace(`${DP}://`, '')
                .replace('https//', 'https://');
            return net.fetch(url);
        } else {
            const path1: string = 'file:///' + url;
            console.log('path1', path1);
            return net.fetch(path1);
        }
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
registerHandler();
app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
