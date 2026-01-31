import 'reflect-metadata';
import { app, BrowserWindow } from 'electron';
import squirrelStartup from 'electron-squirrel-startup';
import path from 'path';
import registerHandler from '@/backend/dispatcher';
import runMigrate from '@/backend/infrastructure/db/migrate';
import { seedDefaultVocabularyIfNeeded } from '@/backend/startup/seedDefaultVocabulary';
import DpTaskServiceImpl from '@/backend/application/services/impl/DpTaskServiceImpl';

// 导入日志 IPC 监听
import '@/backend/adapters/ipc/renderer-log';

if (squirrelStartup) {
    app.quit();
}

const mainWindowRef = {
    current: null as BrowserWindow | null
};
const createWindow = () => {
    // Create the browser window.
    const isMac = process.platform === 'darwin';
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: false,
            allowRunningInsecureContent: true,
        },
        ...(isMac
            ? {
                frame: true,
                titleBarStyle: 'hiddenInset' as const,
            }
            : {
                frame: false,
            }),
    });
    mainWindowRef.current = mainWindow;
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
app.on('ready', async () => {
    await runMigrate();
    await seedDefaultVocabularyIfNeeded();
    await DpTaskServiceImpl.cancelAll();
    createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
registerHandler(mainWindowRef);
