// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import {contextBridge, ipcRenderer, IpcRendererEvent} from 'electron';
import {SettingKey} from './common/types/store_schema';
import {ApiDefinitions, ApiMap} from '@/common/api/api-def';
import {DpTask} from "@/backend/db/tables/dpTask";

export type Channels =
    | 'main-state'
    | 'store-update'
    | 'error-msg'
    | 'info-msg'
    | 'dp-task-update';
const on = (channel: Channels, func: (...args: unknown[]) => void) => {
    const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
    ipcRenderer.on(channel, subscription);

    return () => {
        ipcRenderer.removeListener(channel, subscription);
    };
};
const electronHandler = {
    onStoreUpdate: (func: (key: SettingKey, value: string) => void) => {
        console.log('onStoreUpdate');
        return on('store-update', func as never);
    },
    onErrorMsg: (func: (error: Error) => void) => {
        return on('error-msg', func as never);
    },
    onInfoMsg: (func: (info: string) => void) => {
        return on('info-msg', func as never);
    },
    onTaskUpdate: (func: (task: DpTask) => void) => {
        console.log('onTaskUpdate');
        return on('dp-task-update', func as never);
    },
    // 调用函数的方法
    call: async function invok<K extends keyof ApiMap>(path: K, param?: ApiDefinitions[K]['params']): Promise<ApiDefinitions[K]['return']> {
        return ipcRenderer.invoke(path, param);
    },
    // 调用函数的方法
    safeCall: async function invok<K extends keyof ApiMap>(path: K, param?: ApiDefinitions[K]['params']): Promise<ApiDefinitions[K]['return'] | null> {
        try {
            return await ipcRenderer.invoke(path, param);
        } catch (e) {
            console.error(e);
            return null;
        }
    }
};
contextBridge.exposeInMainWorld('electron', electronHandler);
export type ElectronHandler = typeof electronHandler;
