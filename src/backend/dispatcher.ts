import { ipcMain } from 'electron';
import log from 'electron-log';
import axios from 'axios';
import {
    queryVideoProgress, recentWatch, reloadRecentFromDisk,
    updateVideoProgress
} from './controllers/ProgressController';
import batchTranslate from './controllers/Translate';
import youDaoTrans from './controllers/YouDaoTrans';
import {
    clearCache,
    openDataDir,
    queryCacheSize
} from './controllers/StorageController';
import { appVersion, checkUpdate } from './controllers/CheckUpdate';
import { WindowState } from '@/common/types/Types';
import { WatchProjectVideo } from '@/backend/db/tables/watchProjectVideos';
import { SettingKey } from '@/common/types/store_schema';
import { storeGet, storeSet } from './store';
import { Channels } from '@/preload';
import SubtitleTimestampAdjustmentController from '@/backend/controllers/SubtitleTimestampAdjustmentController';
import {
    InsertSubtitleTimestampAdjustment,
    SubtitleTimestampAdjustment
} from '@/backend/db/tables/subtitleTimestampAdjustment';
import WatchProjectService from '@/backend/services/WatchProjectService';
import { readFromClipboard, writeToClipboard } from '@/backend/controllers/ClopboardController';
import processSentences from '@/backend/controllers/SubtitleProcesser';
import fs from 'fs';
import WhisperController from '@/backend/controllers/WhisperController';
import DpTaskController from '@/backend/controllers/DpTaskController';
import { BaseMessage } from '@langchain/core/messages';
import ChatController from '@/backend/controllers/ChatController';
import { ChatMessageMiddle, fromMsgMiddle } from '@/common/types/ChatMessage';
import { AnalyzeSentenceParams } from '@/common/types/AnalyzeSentenceParams';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { shell } = require('electron');

const handle = (
    channel: Channels,
    listenerWrapper: (...args: any[]) => Promise<void> | any
): void => {
    ipcMain.handle(channel, (event, ...args) => {
        return listenerWrapper(...args);
    });
};

// const sent = (channel: Channels, ...args: any[]) => {
//     mainWindow?.webContents.send(channel, ...args);
// };
export default function registerHandler(mainWindowRef: { current: Electron.CrossProcessExports.BrowserWindow }) {
    ipcMain.on('update-process', async (event, arg) => {
        log.info('ipcMain update-process', arg);
        event.reply('update-process', 'success');
    });
    handle(
        'store-set',
        async (key: SettingKey, value: string | undefined | null) => {
            if (storeSet(key, value)) {
                mainWindowRef.current?.webContents.send('store-update', key, value);
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
        // return wordsTranslate(words);
    });

    handle('ai-chat', async (msgMiddles: ChatMessageMiddle[]) => {
        //BaseMessage[]
        console.log('chat', msgMiddles);
        const msgs = msgMiddles.map((msg) => fromMsgMiddle(msg));
        return ChatController.chat(msgs);
    });
    handle('ai-analyze-current', async (params: AnalyzeSentenceParams) => {
        log.info('ai-analyze-current');
        return ChatController.analyzeSentence(params);
    });
    // handle(
    //     'list-words-view',
    //     async (
    //         whereSql: string,
    //         orderBySql: string,
    //         perPage: number,
    //         currentPage: number
    //     ) => {
    //         log.info('list-words-level');
    //         return listWordsView(whereSql, orderBySql, perPage, currentPage);
    //     }
    // );
    // handle('batch-update-level-words', async (words: WordView[]) => {
    //     log.info('update-words-level', words);
    //     return updateWordsView(words);
    // });
    // handle('mark-word-level', async (word: string, familiar: boolean) => {
    //     log.info('mark-word-level');
    //     return markWordLevel(word, familiar);
    // });
    handle('dp-task-detail', async (id: number) => {
        log.info('dp-task-detail');
        return DpTaskController.detail(id);
    });
    handle('dp-task-cancel', async (id: number) => {
        log.info('dp-task-cancel');
        await DpTaskController.cancel(id);
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
            mainWindowRef.current?.setWindowButtonVisibility(true);
        }
    });
    handle('hide-button', async () => {
        log.info('hide-button');
        // 隐藏红绿灯
        if (process.platform === 'darwin') {
            mainWindowRef.current?.setWindowButtonVisibility(false);
        }
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
        await shell.openExternal(url);
    });
    handle('player-size', async () => {
        log.info('player-size');
        mainWindowRef.current?.setResizable(true);
        mainWindowRef.current?.setMaximizable(true);
        mainWindowRef.current?.maximize();
    });
    handle('main-state', async (state: WindowState) => {
        switch (state) {
            case 'normal':
                mainWindowRef.current?.unmaximize();
                mainWindowRef.current?.setFullScreen(false);
                break;
            case 'maximized':
                mainWindowRef.current?.maximize();
                break;
            case 'minimized':
                mainWindowRef.current?.minimize();
                break;
            case 'fullscreen':
                mainWindowRef.current?.setFullScreen(true);
                break;
            case 'closed':
                mainWindowRef.current?.close();
                break;
            default:
                break;
        }
    });
    handle('home-size', async () => {
        log.info('home-size');
        mainWindowRef.current?.unmaximize();
        mainWindowRef.current?.setSize(800, 600);
        mainWindowRef.current?.setResizable(false);
        mainWindowRef.current?.setMaximizable(false);
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
    handle(
        'subtitle-timestamp-record',
        async (e: InsertSubtitleTimestampAdjustment) => {
            await SubtitleTimestampAdjustmentController.record(e);
        }
    );
    handle('subtitle-timestamp-delete-key', async (key: string) => {
        await SubtitleTimestampAdjustmentController.deleteByKey(key);
    });
    handle('subtitle-timestamp-delete-path', async (subtitlePath: string) => {
        await SubtitleTimestampAdjustmentController.deleteByPath(subtitlePath);
    });
    handle('subtitle-timestamp-get-key', async (key: string) => {
        return SubtitleTimestampAdjustmentController.getByKey(key);
    });
    handle('transcript', async (filePath: string) => {
        console.log('transcript', filePath);
        return await WhisperController.transcript(filePath);
    });

    handle(
        'subtitle-timestamp-get-path',
        async (
            subtitlePath: string
        ): Promise<SubtitleTimestampAdjustment[]> => {
            return SubtitleTimestampAdjustmentController.getByPath(
                subtitlePath
            );
        }
    );
}
