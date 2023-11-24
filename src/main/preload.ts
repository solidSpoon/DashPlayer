import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { YdRes } from '../renderer/lib/param/yd/a';
import { Release } from './controllers/CheckUpdate';
import { SettingState } from '../renderer/hooks/useSetting';
import { WindowState } from '../types/Types';
import { WordLevel } from '../db/entity/WordLevel';
import { Pagination } from '../db/service/WordLevelService';
import { SentenceStruct } from '../types/SentenceStruct';
import { WordLevelRes } from './controllers/WordLevelController';
import { WatchProjectVO } from '../db/service/WatchProjectService';
import { WatchProjectVideo } from '../db/entity/WatchProjectVideo';

export type Channels =
    | 'main-state'
    | 'setting-state'
    | 'ipc-example'
    | 'update-progress'
    | 'trans-word'
    | 'query-progress'
    | 'batch-translate'
    | 'update-setting'
    | 'get-setting'
    | 'setting-update'
    | 'show-button'
    | 'hide-button'
    | 'is-windows'
    | 'open-menu'
    | 'you-dao-translate'
    | 'get-audio'
    | 'open-data-dir'
    | 'query-cache-size'
    | 'clear-cache'
    | 'open-url'
    | 'check-update'
    | 'app-version'
    | 'player-size'
    | 'home-size'
    | 'recent-watch'
    | 'reload-recent-from-disk'
    | 'open-file'
    | 'words-translate'
    | 'list-level-words'
    | 'batch-update-level-words'
    | 'mark-word-level'
    | 'write-to-clipboard'
    | 'read-from-clipboard'
    | 'process-sentences'
    | 'select-file';

const invoke = (channel: Channels, ...args: unknown[]) => {
    return ipcRenderer.invoke(channel, ...args);
};

const on = (channel: Channels, func: (...args: unknown[]) => void) => {
    const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
    ipcRenderer.on(channel, subscription);

    return () => {
        ipcRenderer.removeListener(channel, subscription);
    };
};
const electronHandler = {
    ipcRenderer: {
        sendMessage(channel: Channels, args: unknown[]) {
            ipcRenderer.send(channel, args);
        },
        on(channel: Channels, func: (...args: unknown[]) => void) {
            const subscription = (
                _event: IpcRendererEvent,
                ...args: unknown[]
            ) => func(...args);
            ipcRenderer.on(channel, subscription);

            return () => {
                ipcRenderer.removeListener(channel, subscription);
            };
        },
        once(channel: Channels, func: (...args: unknown[]) => void) {
            ipcRenderer.once(channel, (_event, ...args) => func(...args));
        },
        invoke(channel: Channels, ...args: unknown[]) {
            try {
                const promise = ipcRenderer.invoke(channel, ...args);
                console.log('promise', promise);
                return promise;
            } catch (error) {
                console.error(error);
            }
            return null;
        }
    },
    setMainState: async (state: WindowState) => {
        await invoke('main-state', state);
    },
    setSettingState: async (state: WindowState) => {
        await invoke('setting-state', state);
    },
    updateSetting: async (setting: SettingState) => {
        await invoke('update-setting', setting);
    },
    getSetting: async () => {
        return (await invoke('get-setting')) as SettingState;
    },
    transWord: async (word: string) => {
        return (await invoke('you-dao-translate', word)) as YdRes;
    },
    fetchAudio: async (url: string) => {
        const data = (await invoke('get-audio', url)) as any;
        const blob = new Blob([data], { type: 'audio/mpeg' });
        return URL.createObjectURL(blob);
    },
    queryCacheSize: async () => {
        return (await invoke('query-cache-size')) as string;
    },
    openDataFolder: async () => {
        await invoke('open-data-dir');
    },
    clearCache: async () => {
        await invoke('clear-cache');
    },
    openMenu: async () => {
        await invoke('open-menu');
    },
    playerSize: async () => {
        await invoke('player-size');
    },
    homeSize: async () => {
        await invoke('home-size');
    },
    showButton: async () => {
        await invoke('show-button');
    },
    hideButton: async () => {
        await invoke('hide-button');
    },
    batchTranslate: async (
        sentences: string[]
    ): Promise<Map<string, string>> => {
        const mapping = (await invoke('batch-translate', sentences)) as Map<
            string,
            string
        >;
        return mapping;
    },
    updateProgress: async (progress: WatchProjectVideo) => {
        await invoke('update-progress', progress);
    },
    queryProgress: async (videoId: number) => {
        return (await invoke('query-progress', videoId)) as WatchProjectVideo;
    },
    checkUpdate: async () => {
        return (await invoke('check-update')) as Release | undefined;
    },
    markWordLevel: async (word: string, familiar: boolean) => {
        return (await invoke('mark-word-level', word, familiar)) as void;
    },
    listWordsLevel: async (
        whereSql: string,
        orderBySql: string,
        perPage: number,
        currentPage: number
    ) => {
        return (await invoke(
            'list-level-words',
            whereSql,
            orderBySql,
            perPage,
            currentPage
        )) as Pagination<WordLevel>;
    },
    batchUpdateLevelWords: async (words: WordLevel[]) => {
        console.log('batchUpdateLevelWords', words);
        return (await invoke('batch-update-level-words', words)) as void;
    },
    wordsTranslate: async (words: string[]) => {
        return (await invoke('words-translate', words)) as Map<
            string,
            WordLevelRes
        >;
    },
    appVersion: async () => {
        return (await invoke('app-version')) as string;
    },
    openUrl: async (url: string) => {
        await invoke('open-url', url);
    },
    openFile: async (path: string) => {
        const data = await invoke('open-file', path);
        if (data === null) return null;
        const blob = new Blob([data]);
        return URL.createObjectURL(blob);
    },
    writeToClipboard: async (text: string) => {
        await invoke('write-to-clipboard', text);
    },
    readFromClipboard: async () => {
        return (await invoke('read-from-clipboard')) as string;
    },
    recentWatch: async () => {
        return (await invoke('recent-watch')) as WatchProjectVO[];
    },
    reloadRecentFromDisk: async () => {
        return (await invoke('reload-recent-from-disk')) as WatchProjectVO[];
    },
    isWindows: async () => {
        return (await invoke('is-windows')) as boolean;
    },
    selectFile: async (isFolder:boolean) => {
        return (await invoke('select-file',isFolder)) as WatchProjectVO | undefined | string;
    },
    processSentences: async (sentences: string[]) => {
        return (await invoke(
            'process-sentences',
            sentences
        )) as SentenceStruct[];
    },
    onUpdateSetting: (func: (setting: SettingState) => void) => {
        console.log('onUpdateSetting');
        return on('update-setting', func as any);
    },
    onMainState: (func: (state: WindowState) => void) => {
        return on('main-state', func as any);
    },
    onSettingState: (func: (state: WindowState) => void) => {
        return on('setting-state', func as any);
    }
};
contextBridge.exposeInMainWorld('electron', electronHandler);
export type ElectronHandler = typeof electronHandler;
