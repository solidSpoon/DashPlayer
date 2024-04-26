// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import {contextBridge, ipcRenderer, IpcRendererEvent} from 'electron';
import {SettingKey} from './common/types/store_schema';
import {WindowState} from './common/types/Types';
import Release from '@/common/types/release';
import {
    InsertSubtitleTimestampAdjustment,
    SubtitleTimestampAdjustment
} from '@/backend/db/tables/subtitleTimestampAdjustment';
import {ApiDefinitions, ApiMap} from "@/common/api/api-def";

export type Channels =
    | 'main-state'
    | 'setting-state'
    | 'ipc-example'
    | 'trans-word'
    | 'batch-translate'
    | 'show-button'
    | 'hide-button'
    | 'is-windows'
    | 'open-menu'
    | 'get-audio'
    | 'open-data-dir'
    | 'query-cache-size'
    | 'clear-cache'
    | 'open-url'
    | 'check-update'
    | 'app-version'
    | 'player-size'
    | 'home-size'
    | 'open-file'
    | 'words-translate'
    | 'list-words-view'
    | 'batch-update-level-words'
    | 'store-set'
    | 'store-get'
    | 'store-update'
    | 'select-file'
    | 'subtitle-timestamp-record'
    | 'subtitle-timestamp-get-key';

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
    subtitleTimestampRecord: async (
        e: InsertSubtitleTimestampAdjustment
    ): Promise<void> => {
        await invoke('subtitle-timestamp-record', e);
    },
    storeSet: async (key: SettingKey, value: string | null | undefined) => {
        await invoke('store-set', key, value);
    },
    storeGet: async (key: SettingKey) => {
        return (await invoke('store-get', key)) as string;
    },
    setMainState: async (state: WindowState) => {
        await invoke('main-state', state);
    },
    fetchAudio: async (url: string) => {
        const data = (await invoke('get-audio', url)) as never;
        const blob = new Blob([data], {type: 'audio/mpeg'});
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
    playerSize: async () => {
        await invoke('player-size');
    },
    homeSize: async () => {
        await invoke('home-size');
    },
    checkUpdate: async () => {
        return (await invoke('check-update')) as Release[];
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
    onStoreUpdate: (func: (key: SettingKey, value: string) => void) => {
        console.log('onStoreUpdate');
        return on('store-update', func as never);
    },
    onMainState: (func: (state: WindowState) => void) => {
        return on('main-state', func as never);
    },
    // 调用函数的方法
    call: async function invok<K extends keyof ApiMap>(path: K, param: ApiDefinitions[K]['params']): Promise<ApiDefinitions[K]['return']> {
        return ipcRenderer.invoke(path, param);
    }
};
contextBridge.exposeInMainWorld('electron', electronHandler);
export type ElectronHandler = typeof electronHandler;
