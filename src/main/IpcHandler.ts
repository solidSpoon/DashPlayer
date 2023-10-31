import { ipcMain, clipboard } from 'electron';
import log from 'electron-log';
import axios from 'axios';
import fs from 'fs';
import {
    ProgressParam,
    queryProgress,
    queryRecentPlay,
    updateProgress,
} from './controllers/ProgressController';
import batchTranslate, { loadTransCache } from './controllers/Translate';
import youDaoTrans from './controllers/YouDaoTrans';
import { createSettingWindowIfNeed, mainWindow, settingWindow } from './main';
import {
    clearCache,
    openDataDir,
    queryCacheSize,
} from './controllers/StorageController';
import { Channels } from './preload';
import { appVersion, checkUpdate } from './controllers/CheckUpdate';
import { SettingState } from '../renderer/hooks/useSetting';
import { getSetting, updateSetting } from './controllers/SettingController';
import { WindowState } from '../types/Types';
import { SentenceApiParam } from '../types/TransApi';
import {
    markWordLevel,
    wordsTranslate,
} from './controllers/WordLevelController';

const handle = (
    channel: Channels,
    listenerWrapper: (...args: any[]) => Promise<void> | any
): void => {
    ipcMain.handle(channel, (event, ...args) => {
        return listenerWrapper(...args);
    });
};

const sent = (channel: Channels, ...args: any[]) => {
    mainWindow?.webContents.send(channel, ...args);
};
export default function registerHandler() {
    ipcMain.on('update-process', async (event, arg) => {
        log.info('ipcMain update-process', arg);
        event.reply('update-process', 'success');
    });
    handle('update-progress', async (progress: ProgressParam) => {
        log.info('update-progress', progress);
        await updateProgress(progress);
    });
    handle('query-progress', async (fileName: string) => {
        log.info('query-progress', fileName);
        const progress = await queryProgress(fileName);
        log.info(`query-progress file: ${fileName}, progress: ${progress}`);
        return progress;
    });
    handle('batch-translate', async (sentences: SentenceApiParam[]) => {
        log.info('batch-translate');
        return batchTranslate(sentences);
    });
    handle('load-trans-cache', async (sentences: SentenceApiParam[]) => {
        log.info('load-trans-cache');
        return loadTransCache(sentences);
    });
    handle('update-setting', async (setting: SettingState) => {
        log.info('update-setting');
        await updateSetting(setting);
        console.log('update-setting', setting);
        mainWindow?.webContents.send('update-setting', setting);
        settingWindow?.webContents.send('update-setting', setting);
    });
    handle('get-setting', async () => {
        log.info('get-setting');
        return getSetting();
    });

    handle('is-windows', async () => {
        log.info('is-windows');
        return process.platform === 'win32';
    });

    handle('words-translate', async (words: string[]) => {
        log.info('words-translate');
        return wordsTranslate(words);
    });

    handle('mark-word-level', async (word: string, level: number) => {
        log.info('mark-word-level');
        return markWordLevel(word, level);
    });

    handle('you-dao-translate', async (word) => {
        log.info('you-dao-translate');
        return youDaoTrans(word);
    });
    handle('get-audio', async (url) => {
        log.info('get-audio', url);
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return response.data;
    });
    handle('show-button', async () => {
        log.info('show-button');
        // 展示红绿灯
        if (process.platform === 'darwin') {
            mainWindow?.setWindowButtonVisibility(true);
        }
    });
    handle('hide-button', async () => {
        log.info('hide-button');
        // 隐藏红绿灯
        if (process.platform === 'darwin') {
            mainWindow?.setWindowButtonVisibility(false);
        }
    });

    handle('open-menu', async () => {
        console.log('open-menu');
        // create or show setting window
        await createSettingWindowIfNeed();
        settingWindow?.show();
    });
    handle('open-data-dir', async () => {
        log.info('open-data-dir');
        await openDataDir();
    });
    handle('query-cache-size', async () => {
        log.info('query-cache-size');
        return queryCacheSize();
    });
    handle('clear-cache', async () => {
        log.info('clear-cache');
        await clearCache();
    });
    handle('check-update', async () => {
        log.info('check-update');
        return checkUpdate();
    });
    handle('app-version', async () => {
        log.info('app-version');
        return appVersion();
    });
    handle('open-url', async (url: string) => {
        log.info('open-url', url);
    });
    handle('player-size', async () => {
        log.info('player-size');
        mainWindow?.setResizable(true);
        mainWindow?.setMaximizable(true);
        mainWindow?.maximize();
        // mainWindow?.setMaximizable(true);
    });
    handle('main-state', async (state: WindowState) => {
        switch (state) {
            case 'normal':
                mainWindow?.unmaximize();
                mainWindow?.setFullScreen(false);
                break;
            case 'maximized':
                mainWindow?.maximize();
                break;
            case 'minimized':
                mainWindow?.minimize();
                break;
            case 'fullscreen':
                mainWindow?.setFullScreen(true);
                break;
            case 'closed':
                mainWindow?.close();
                break;
            default:
                break;
        }
    });
    handle('setting-state', async (state: WindowState) => {
        switch (state) {
            case 'normal':
                settingWindow?.unmaximize();
                break;
            case 'maximized':
                settingWindow?.maximize();
                break;
            case 'minimized':
                settingWindow?.minimize();
                break;
            case 'closed':
                settingWindow?.close();
                break;
            default:
                break;
        }
    });
    handle('home-size', async () => {
        log.info('home-size');
        mainWindow?.unmaximize();
        mainWindow?.setSize(800, 600);
        mainWindow?.setResizable(false);
        mainWindow?.setMaximizable(false);
    });
    handle('recent-play', async (size: number) => {
        log.info('recent-play');
        return queryRecentPlay(size);
    });
    handle('open-file', async (path: string) => {
        log.info('open-file', path);
        // 如果文件存在, 则返回文件流, 否则返回null
        // 检查文件是否存在
        if (!fs.existsSync(path)) {
            log.info('open-file', '文件不存在');
            return null;
        }

        return new Promise((resolve, reject) => {
            fs.readFile(path, (err, data) => {
                if (err) {
                    reject(err);
                }
                resolve(Buffer.from(data));
            });
        });
    });
    handle('copy-to-clipboard', async (text: string) => {
        console.log('copy-to-clipboard', text);
        clipboard.writeText(text);
        return true;
    });
}
