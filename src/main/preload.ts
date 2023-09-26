import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { YdRes } from '../renderer/lib/param/yd/a';

export type Channels =
    | 'ipc-example'
    | 'update-progress'
    | 'trans-word'
    | 'query-progress'
    | 'batch-translate'
    | 'update-tenant-secret'
    | 'get-tenant-secret'
    | 'get-you-dao-secret'
    | 'update-you-dao-secret'
    | 'update-shortcut'
    | 'get-shortcut'
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
    | 'pronounce'
    | 'get-audio'
    | 'open-data-dir'
    | 'query-cache-size'
    | 'clear-cache';

const invoke = (channel: Channels, ...args: unknown[]) => {
    return ipcRenderer.invoke(channel, ...args);
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
};
contextBridge.exposeInMainWorld('electron', electronHandler);
export type ElectronHandler = typeof electronHandler;
