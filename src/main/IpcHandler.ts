import { ipcMain } from 'electron';
import log from 'electron-log';
import axios from 'axios';
import fs from 'fs';
import { IServerSideGetRowsRequest } from 'ag-grid-community';
import Store from 'electron-store';
import {
    queryVideoProgress,
    recentWatch,
    reloadRecentFromDisk,
    updateVideoProgress,
} from './controllers/ProgressController';
import batchTranslate from './controllers/Translate';
import youDaoTrans from './controllers/YouDaoTrans';
import { createSettingWindowIfNeed, mainWindow, settingWindow } from './main';
import {
    clearCache,
    openDataDir,
    queryCacheSize,
} from './controllers/StorageController';
import { Channels } from './preload';
import { appVersion, checkUpdate } from './controllers/CheckUpdate';
import { WindowState } from '../common/types/Types';
import {
    listWordsView,
    markWordLevel,
    updateWordsView,
    wordsTranslate,
} from './controllers/WordLevelController';
import {
    readFromClipboard,
    writeToClipboard,
} from './controllers/ClopboardController';
import processSentences from './controllers/SubtitleProcesser';
import { WordView } from './tables/wordView';
import { WatchProjectVideo } from './tables/watchProjectVideos';
import WatchProjectService from './services/WatchProjectService';
import { SettingKey, SettingKeyObj } from '../common/types/store_schema';
import { strBlank } from '../common/utils/Util';
import { storeGet, storeSet } from './store';

const { shell } = require('electron');

const store = new Store();
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
    handle(
        'store-set',
        async (key: SettingKey, value: string | undefined | null) => {
            if (storeSet(key, value)) {
                mainWindow?.webContents.send('store-update', key, value);
                settingWindow?.webContents.send('store-update', key, value);
            }
        }
    );
    handle('store-get', async (key: SettingKey) => {
        return storeGet(key);
    });
    handle('update-progress', async (progress: WatchProjectVideo) => {
        log.info('update-progress', progress);
        await updateVideoProgress(progress);
    });
    handle('query-progress', async (videoId: number) => {
        log.info('query-progress', videoId);
        const progress = await queryVideoProgress(videoId);
        log.info(`query-progress file: ${videoId}, progress: ${progress}`);
        return progress;
    });
    handle(
        'batch-translate',
        async (sentences: string[]): Promise<Map<string, string>> => {
            log.info('batch-translate');
            return batchTranslate(sentences);
        }
    );
    handle('is-windows', async () => {
        log.info('is-windows');
        return process.platform === 'win32';
    });

    handle('words-translate', async (words: string[]) => {
        log.info('words-translate');
        return wordsTranslate(words);
    });

    handle(
        'list-words-view',
        async (
            whereSql: string,
            orderBySql: string,
            perPage: number,
            currentPage: number
        ) => {
            log.info('list-words-level');
            return listWordsView(whereSql, orderBySql, perPage, currentPage);
        }
    );
    handle('batch-update-level-words', async (words: WordView[]) => {
        log.info('update-words-level', words);
        return updateWordsView(words);
    });
    handle('mark-word-level', async (word: string, familiar: boolean) => {
        log.info('mark-word-level');
        return markWordLevel(word, familiar);
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
        await shell.openExternal(
            'https://github.com/solidSpoon/DashPlayer/releases/latest'
        );
    });
    handle('player-size', async () => {
        log.info('player-size');
        mainWindow?.setResizable(true);
        mainWindow?.setMaximizable(true);
        mainWindow?.maximize();
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
    handle('recent-watch', async () => {
        log.info('recent-watch');
        return recentWatch();
    });
    handle('reload-recent-from-disk', async () => {
        log.info('reload-recent-from-disk');
        return reloadRecentFromDisk();
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
    handle('write-to-clipboard', async (text: string) => {
        writeToClipboard(text);
        return true;
    });
    handle('read-from-clipboard', async () => {
        return readFromClipboard();
    });
    handle('process-sentences', async (sentences: string[]) => {
        return processSentences(sentences);
    });
    handle('select-file', async (isFolder: boolean) => {
        return WatchProjectService.selectFiles(isFolder);
    });
    handle(
        'get-video',
        async (videoId: number): Promise<WatchProjectVideo | undefined> => {
            return WatchProjectService.getVideo(videoId);
        }
    );
}
