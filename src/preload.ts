// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import {contextBridge, ipcRenderer, IpcRendererEvent} from 'electron';
import {SettingKey} from './common/types/store_schema';
import {WindowState} from './common/types/Types';
import {ApiDefinitions, ApiMap} from "@/common/api/api-def";

export type Channels =
    | 'main-state'
    | 'get-audio'
    | 'open-file'
    | 'store-update';

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
    fetchAudio: async (url: string) => {
        const data = (await invoke('get-audio', url)) as never;
        const blob = new Blob([data], {type: 'audio/mpeg'});
        return URL.createObjectURL(blob);
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
