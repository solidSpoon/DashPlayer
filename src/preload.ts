// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import {contextBridge, ipcRenderer, IpcRendererEvent} from 'electron';
import {SettingKey} from './common/types/store_schema';
import {ApiDefinitions, ApiMap} from '@/common/api/api-def';
import {DpTask} from "@/backend/db/tables/dpTask";
import {RendererApiDefinitions, RendererApiMap} from '@/common/api/renderer-api-def';
import type { SimpleEvent } from '@/common/log/simple-types';

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
        return on('store-update', func as never);
    },
    onErrorMsg: (func: (error: Error) => void) => {
        return on('error-msg', func as never);
    },
    onInfoMsg: (func: (info: string) => void) => {
        return on('info-msg', func as never);
    },
    onTaskUpdate: (func: (task: DpTask) => void) => {
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
            // Error handling for renderer API registration
            return null;
        }
    },
    
    // 前端API注册方法
    registerRendererApi: function<K extends keyof RendererApiMap>(
        path: K, 
        handler: RendererApiMap[K]
    ): () => void {
        const listener = async (event: IpcRendererEvent, callId: string, params: any) => {
            try {
                const result = await (handler as any)(params);
                ipcRenderer.send(`renderer-api-response-${callId}`, { success: true, result });
            } catch (error) {
                ipcRenderer.send(`renderer-api-response-${callId}`, { 
                    success: false, 
                    error: error instanceof Error ? error.message : String(error) 
                });
            }
        };
        
        ipcRenderer.on(`renderer-api-call-${path}`, listener);
        
        return () => {
            ipcRenderer.removeListener(`renderer-api-call-${path}`, listener);
        };
    },
    
    // 批量注册前端API方法
    registerRendererApis: function(apis: Partial<RendererApiMap>): () => void {
        const unregisterFunctions: Array<() => void> = [];
        
        for (const [path, handler] of Object.entries(apis) as Array<[keyof RendererApiMap, any]>) {
            const unregister = this.registerRendererApi(path, handler);
            unregisterFunctions.push(unregister);
        }
        
        return () => {
            unregisterFunctions.forEach(unregister => unregister());
        };
    },

    // 日志写入方法
    dpLogger: {
        write: (e: SimpleEvent) => ipcRenderer.send('dp-log/write', e),
    }
};
contextBridge.exposeInMainWorld('electron', electronHandler);
export type ElectronHandler = typeof electronHandler;
