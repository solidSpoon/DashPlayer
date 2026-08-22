import 'dotenv/config';
import 'reflect-metadata';
import { app, BrowserWindow, type Session } from 'electron';
import squirrelStartup from 'electron-squirrel-startup';
import fs from 'fs';
import path from 'path';
import installExtension, { REACT_DEVELOPER_TOOLS } from 'electron-devtools-installer';
import registerHandler from '@/backend/dispatcher';
import { setConcurrencyLogger } from '@/backend/utils/concurrency';
import { seedDefaultVocabularyIfNeeded } from '@/backend/startup/seedDefaultVocabulary';
import { DpTaskServiceImpl } from '@/backend/services/DpTaskService';
import runStartupMigrations from '@/backend/startup/runStartupMigrations';
import { initProxyFeature } from '@/backend/startup/initProxy';
import container from '@/backend/ioc/inversify.config';
import TYPES from '@/backend/ioc/types';
import { FavouriteClipsService } from '@/backend/services/FavouriteClipsService';
import { VideoLearningService } from '@/backend/services/VideoLearningService';
import { getMainLogger } from '@/backend/infrastructure/logger';
import { RESET_DB_RESYNC_FLAG } from '@/common/constants/resetDb';
import { isDevelopmentMode } from '@/backend/utils/runtimeEnv';
import { storeGet } from '@/backend/infrastructure/settings/store';
import { TranscriptionService } from '@/backend/services/TranscriptionService';

// 导入日志 IPC 监听
import '@/backend/controllers/ipc/renderer-log';

if (squirrelStartup) {
    app.quit();
}

const logger = getMainLogger('MainStartup');
const devtoolsLogger = getMainLogger('devtools');
const startupStartedAt = performance.now();
// 组合根运行期注入并发工具日志端口，保持通用工具不依赖基础设施。
setConcurrencyLogger(getMainLogger('concurrency'));

/**
 * 记录主进程启动阶段耗时，统一使用进程启动后的相对毫秒数。
 * @param phase 已完成的启动阶段名称。
 */
const logStartupPhase = (phase: string): void => {
    logger.info('startup phase completed', {
        phase,
        durationMs: Math.round(performance.now() - startupStartedAt),
    });
};

const mainWindowRef = {
    current: null as BrowserWindow | null
};

/**
 * 判断本次启动是否由“重置数据库”触发。
 * @returns 命令行参数中是否包含重同步标记。
 */
const shouldResyncAfterResetDb = (): boolean => {
    return process.argv.includes(RESET_DB_RESYNC_FLAG);
};

/**
 * 在重置数据库后的首次启动执行本地文件回灌。
 *
 * 行为说明：
 * - 以本地收藏/学习片段目录为准，重建数据库索引。
 * - 任一同步失败仅记录日志，不阻断主窗口启动。
 */
const runResyncAfterResetDbIfNeeded = async (): Promise<void> => {
    if (!shouldResyncAfterResetDb()) {
        return;
    }

    try {
        const favouriteClipsService = container.get<FavouriteClipsService>(TYPES.FavouriteClips);
        const videoLearningService = container.get<VideoLearningService>(TYPES.VideoLearningService);

        await favouriteClipsService.syncFromOss();
        await videoLearningService.syncFromOss();

        logger.info('Resync after reset-db completed');
    } catch (error) {
        logger.error('Resync after reset-db failed', { error });
    }
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
            devtoolsLogger.info('React DevTools loaded from Chrome profile', { extensionDir });
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
        devtoolsLogger.info('React DevTools installed via electron-devtools-installer');
        return;
    } catch (error) {
        devtoolsLogger.warn('Failed to install React DevTools via downloader', { error });
    }

    const loaded = await installReactDevToolsFromChromeProfile(targetSession);
    if (!loaded) {
        devtoolsLogger.warn('React DevTools not installed (no downloader access and no local Chrome/Edge extension found)');
    }
};

/**
 * 创建主窗口并加载渲染端入口。
 *
 * 行为说明：
 * - 开发模式加载 Vite dev server 并尝试安装 React DevTools；
 * - 生产模式直接加载打包后的 renderer 文件。
 */
const createWindow = () => {
    logger.info('main window created');
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
    mainWindow.webContents.once('dom-ready', () => {
        logger.info('renderer dom ready', {
            durationMs: Math.round(performance.now() - startupStartedAt),
        });
    });
    mainWindow.webContents.once('did-finish-load', () => {
        logger.info('renderer finished loading', {
            durationMs: Math.round(performance.now() - startupStartedAt),
        });
    });
    // and load the index.html of the app.
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        void installReactDevTools(mainWindow.webContents.session).then(() => {
            const installed = mainWindow.webContents.session.extensions
                .getAllExtensions()
                .some((ext) => ext.id === REACT_DEVELOPER_TOOLS.id);
            devtoolsLogger.info('React DevTools extension present', { installed });
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
    await runStartupMigrations();
    logStartupPhase('migrations');
    // 数据库迁移完成后再解析控制器，避免服务的 postConstruct 提前访问未建表数据库。
    registerHandler(mainWindowRef);
    logStartupPhase('controllers');
    await seedDefaultVocabularyIfNeeded();
    await DpTaskServiceImpl.cancelAll();
    await container
        .get<TranscriptionService>(TYPES.LocalTranscriptionService)
        .recoverInterruptedTasks();
    logStartupPhase('background recovery');
    await runResyncAfterResetDbIfNeeded();
    await initProxyFeature();
    logStartupPhase('proxy');
    // 生命周期标记：会话何时开始、以什么配置运行，便于回溯“有活动却无日志”的问题。
    logger.info('app ready', {
        version: app.getVersion(),
        platform: process.platform,
        mode: isDevelopmentMode() ? 'development' : 'production',
        proxyMode: storeGet('proxy.mode'),
    });
    createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    logger.info('all windows closed', { platform: process.platform });
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
app.on('before-quit', () => {
    logger.info('app before quit');
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
