import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { YdRes } from '../renderer/lib/param/yd/a';
import { SentenceApiParam } from '../renderer/hooks/useSubtitle';
import { Release } from './controllers/CheckUpdate';
import { ProgressParam } from './controllers/ProgressController';

export type Channels =
    | 'ipc-example'
    | 'update-progress'
    | 'trans-word'
    | 'query-progress'
    | 'batch-translate'
    | 'load-trans-cache'
    | 'update-tenant-secret'
    | 'get-tenant-secret'
    | 'get-you-dao-secret'
    | 'update-you-dao-secret'
    | 'update-shortcut'
    | 'get-shortcut'
    | 'setting-update'
    | 'tencent-secret-update'
    | 'maximize'
    | 'unmaximize'
    | 'is-maximized'
    | 'is-full-screen'
    | 'show-button'
    | 'hide-button'
    | 'maximize-setting'
    | 'unmaximize-setting'
    | 'is-maximized-setting'
    | 'close-setting'
    | 'minimize-setting'
    | 'is-windows'
    | 'minimize'
    | 'close'
    | 'open-menu'
    | 'you-dao-translate'
    | 'get-audio'
    | 'open-data-dir'
    | 'query-cache-size'
    | 'clear-cache'
    | 'open-url'
    | 'check-update'
    | 'app-version'
    | 'player-size';

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
        },
    },
    transWord: async (word: string) => {
        return (await invoke('you-dao-translate', word)) as YdRes;
    },
    fetchAudio: async (url: string) => {
        const data = (await invoke('get-audio', url)) as any;
        const blob = new Blob([data], { type: 'audio/mpeg' });
        return URL.createObjectURL(blob);
    },
    isSettingMaximized: async () => {
        return (await invoke('is-maximized-setting')) as boolean;
    },
    maximizeSetting: async () => {
        await invoke('maximize-setting');
    },
    unMaximizeSetting: async () => {
        await invoke('unmaximize-setting');
    },
    closeSetting: async () => {
        await invoke('close-setting');
    },
    minimizeSetting: async () => {
        await invoke('minimize-setting');
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
    isMaximized: async () => {
        return (await invoke('is-maximized')) as boolean;
    },
    unMaximize: async () => {
        await invoke('unmaximize');
    },
    maximize: async () => {
        await invoke('maximize');
    },
    minimize: async () => {
        await invoke('minimize');
    },
    playerSize: async () => {
        await invoke('player-size');
    },
    close: async () => {
        await invoke('close');
    },
    isFullScreen: async () => {
        return (await invoke('is-full-screen')) as boolean;
    },
    showButton: async () => {
        await invoke('show-button');
    },
    hideButton: async () => {
        await invoke('hide-button');
    },
    loadTransCache: async (sentences: SentenceApiParam[]) => {
        return (await invoke(
            'load-trans-cache',
            sentences
        )) as SentenceApiParam[];
    },
    batchTranslate: async (sentences: SentenceApiParam[]) => {
        return (await invoke(
            'batch-translate',
            sentences
        )) as SentenceApiParam[];
    },
    updateProgress: async (progress: ProgressParam) => {
        await invoke('update-progress', progress);
    },
    queryProgress: async (fileName: string) => {
        return (await invoke('query-progress', fileName)) as number;
    },
    checkUpdate: async () => {
        return (await invoke('check-update')) as Release | undefined;
    },
    appVersion: async () => {
        return (await invoke('app-version')) as string;
    },
    openUrl: async (url: string) => {
        await invoke('open-url', url);
    },
    onMaximize: (func: () => void) => {
        return on('maximize', func);
    },
    onUnMaximize: (func: () => void) => {
        return on('unmaximize', func);
    },
    onSettingMaximize: (func: () => void) => {
        return on('maximize-setting', func);
    },
    onSettingUnMaximize: (func: () => void) => {
        return on('unmaximize-setting', func);
    },
    onSettingUpdate: (func: () => void) => {
        return on('setting-update', func);
    },
    onTencentSecretUpdate: (func: () => void) => {
        return on('tencent-secret-update', func);
    },
};
contextBridge.exposeInMainWorld('electron', electronHandler);
export type ElectronHandler = typeof electronHandler;
