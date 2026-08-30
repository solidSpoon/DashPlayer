// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import {contextBridge, ipcRenderer, IpcRendererEvent} from 'electron';
import {RuntimeSettingKey} from './common/contracts/runtime-settings';
import {ApiDefinitions, ApiMap} from '@/common/api/api-def';
import {DpTask} from '@/common/contracts/dp-task';
import {RendererApiDefinitions, RendererApiMap} from '@/common/api/renderer-api-def';
import type { SimpleEvent, TraceCarrier } from '@/common/log/simple-types';

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

/**
 * 为一次 renderer → main IPC 调用创建 trace ID。
 * @returns 32 位小写十六进制 trace ID。
 */
const createTraceCarrier = (): TraceCarrier => ({
    traceId: globalThis.crypto.randomUUID().replaceAll('-', ''),
});

/**
 * 记录字幕翻译回推在 preload 中的收发状态，避免记录译文正文。
 *
 * @param message 生命周期事件名称。
 * @param data 仅包含调用标识、路径、数量和耗时的上下文。
 */
const writeTranslationRendererApiLog = (message: string, data: Record<string, unknown>): void => {
    ipcRenderer.send('dp-log/write', {
        ts: new Date().toISOString(),
        level: 'info',
        process: 'renderer',
        module: 'RendererApiPreload',
        msg: message,
        data,
    } satisfies SimpleEvent);
};

const electronHandler = {
    onStoreUpdate: (func: (key: RuntimeSettingKey, value: string) => void) => {
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
    /**
     * 调用 main 进程 API，并为本次调用附加独立 trace ID。
     * @param path API 路径。
     * @param param API 参数。
     * @returns main 进程返回结果。
     */
    call: async function invok<K extends keyof ApiMap>(path: K, param?: ApiDefinitions[K]['params']): Promise<ApiDefinitions[K]['return']> {
        return ipcRenderer.invoke(path, param, createTraceCarrier());
    },

    // 前端API注册方法
    registerRendererApi: function<K extends keyof RendererApiMap>(
        path: K,
        handler: RendererApiMap[K]
    ): () => void {
        const listener = async (event: IpcRendererEvent, callId: string, params: RendererApiDefinitions[K]['params']) => {
            const isTranslationBatch = path === 'translation/batch-result';
            const startedAt = Date.now();
            const translationCount = isTranslationBatch
                ? (params as RendererApiDefinitions['translation/batch-result']['params']).translations.length
                : undefined;
            if (isTranslationBatch) {
                writeTranslationRendererApiLog('字幕翻译回推已到达 preload', {
                    path,
                    callId,
                    translationCount,
                });
            }
            try {
                const result = await handler(params);
                ipcRenderer.send(`renderer-api-response-${callId}`, { success: true, result });
                if (isTranslationBatch) {
                    writeTranslationRendererApiLog('字幕翻译回推已由 preload 确认', {
                        path,
                        callId,
                        translationCount,
                        elapsedMs: Date.now() - startedAt,
                    });
                }
            } catch (error) {
                ipcRenderer.send(`renderer-api-response-${callId}`, {
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                });
                if (isTranslationBatch) {
                    writeTranslationRendererApiLog('字幕翻译回推 handler 失败', {
                        path,
                        callId,
                        translationCount,
                        elapsedMs: Date.now() - startedAt,
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
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

        for (const [path, handler] of Object.entries(apis) as Array<[keyof RendererApiMap, RendererApiMap[keyof RendererApiMap]]>) {
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
    },
};
contextBridge.exposeInMainWorld('electron', electronHandler);
export type ElectronHandler = typeof electronHandler;
