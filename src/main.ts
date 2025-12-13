import { app, BrowserWindow, protocol, net } from 'electron';
import path from 'path';
import * as fs from 'fs';
import registerHandler from '@/backend/dispatcher';
import runMigrate from '@/backend/db/migrate';
import { DP_FILE, DP } from '@/common/utils/UrlUtil';
import * as base32 from 'hi-base32';
import DpTaskServiceImpl from '@/backend/services/impl/DpTaskServiceImpl';
import 'reflect-metadata';

// 导入日志 IPC 监听
import '@/backend/ipc/renderer-log';
import { getMainLogger } from '@/backend/ioc/simple-logger';

// 在应用启动前设置 DYLD_LIBRARY_PATH
const setupSherpaOnnxEnvironment = () => {
    const platform = process.platform;
    const arch = process.arch;
    
    if (platform === 'darwin' && arch === 'arm64') {
        const libraryPath = 'node_modules/sherpa-onnx-darwin-arm64';
        const resolvedPath = path.resolve('/Users/spoon/projects/DashPlayer', libraryPath);
        
        process.env.DYLD_LIBRARY_PATH = `${resolvedPath}:${process.env.DYLD_LIBRARY_PATH || ''}`;
        getMainLogger('main').info('set dyld library path', { path: resolvedPath });
        getMainLogger('main').debug('sherpa onnx path exists', { exists: fs.existsSync(resolvedPath) });
        getMainLogger('main').debug('sherpa onnx node file exists', { exists: fs.existsSync(path.join(resolvedPath, 'sherpa-onnx.node')) });
    }
};

// 立即执行环境变量设置
setupSherpaOnnxEnvironment();
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
    },
    {
        scheme: DP_FILE,
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
    await DpTaskServiceImpl.cancelAll();
    createWindow();
    protocol.registerFileProtocol(DP_FILE, (request, callback) => {
        const url: string = request.url.replace(`${DP_FILE}://`, '');
        try {
            return callback(decodeURIComponent(url));
        } catch (error) {
            getMainLogger('main').error('protocol decode error', { error });
            return callback('');
        }
    });
    protocol.handle(DP, (request) => {
        let url = request.url.slice(`${DP}://`.length, request.url.length - 1)
            .toUpperCase();
        url = base32.decode(url);
        if (url.startsWith('http')) {
            return net.fetch(url);
        } else {
            const parts = url.split(path.sep);
            const encodedParts = parts.map(part => encodeURIComponent(part));
            const encodedUrl = encodedParts.join(path.sep);
            return net.fetch(`file:///${encodedUrl}`);
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
