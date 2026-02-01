import 'dotenv/config';
import 'reflect-metadata';
import { app, BrowserWindow, type Session } from 'electron';
import squirrelStartup from 'electron-squirrel-startup';
import fs from 'fs';
import path from 'path';
import installExtension, { REACT_DEVELOPER_TOOLS } from 'electron-devtools-installer';
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

const installReactDevToolsFromChromeProfile = async (targetSession: Session): Promise<boolean> => {
    const extensionId = REACT_DEVELOPER_TOOLS.id;
    const home = app.getPath('home');
    const candidates: string[] = [];

    if (process.platform === 'darwin') {
        candidates.push(
            path.join(home, 'Library/Application Support/Google/Chrome/Default/Extensions', extensionId)
        );
        candidates.push(
            path.join(home, 'Library/Application Support/Microsoft Edge/Default/Extensions', extensionId)
        );
    } else if (process.platform === 'win32') {
        const localAppData = process.env.LOCALAPPDATA;
        if (localAppData) {
            candidates.push(
                path.join(localAppData, 'Google/Chrome/User Data/Default/Extensions', extensionId)
            );
            candidates.push(
                path.join(localAppData, 'Microsoft/Edge/User Data/Default/Extensions', extensionId)
            );
        }
    } else {
        candidates.push(path.join(home, '.config/google-chrome/Default/Extensions', extensionId));
        candidates.push(path.join(home, '.config/microsoft-edge/Default/Extensions', extensionId));
    }

    for (const baseDir of candidates) {
        try {
            const entries = await fs.promises.readdir(baseDir, { withFileTypes: true });
            const versions = entries
                .filter((e) => e.isDirectory())
                .map((e) => e.name)
                .sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' }));

            const latest = versions[0];
            if (!latest) {
                continue;
            }

            const extensionDir = path.join(baseDir, latest);
            await targetSession.extensions.loadExtension(extensionDir, { allowFileAccess: true });
            console.info('[devtools] React DevTools loaded from Chrome profile:', extensionDir);
            return true;
        } catch {
            // ignore and try next candidate
        }
    }

    return false;
};

const installReactDevTools = async (targetSession: Session): Promise<void> => {
    try {
        await installExtension(REACT_DEVELOPER_TOOLS, { forceDownload: false, session: targetSession });
        console.info('[devtools] React DevTools installed via electron-devtools-installer');
        return;
    } catch (error) {
        console.warn('[devtools] Failed to install React DevTools via downloader', error);
    }

    const loaded = await installReactDevToolsFromChromeProfile(targetSession);
    if (!loaded) {
        console.warn('[devtools] React DevTools not installed (no downloader access and no local Chrome/Edge extension found)');
    }
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
        void installReactDevTools(mainWindow.webContents.session).then(() => {
            const installed = mainWindow.webContents.session.extensions
                .getAllExtensions()
                .some((ext) => ext.id === REACT_DEVELOPER_TOOLS.id);
            console.info('[devtools] React DevTools extension present:', installed);
        });
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
