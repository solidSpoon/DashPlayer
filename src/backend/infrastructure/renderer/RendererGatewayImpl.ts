import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import RendererGateway from '@/backend/services/gateways/renderer/RendererGateway';
import { RendererApiDefinitions } from '@/common/api/renderer-api-def';
import { getMainLogger } from '@/backend/infrastructure/logger';
import MainWindowRegistry from '@/backend/infrastructure/system/MainWindowRegistry';
import { ipcMain } from 'electron';

/** renderer API 回执允许等待的最长时间，超时后明确释放 IPC 监听器。 */
const RENDERER_API_RESPONSE_TIMEOUT_MS = 10_000;

/**
 * 通过 Electron IPC 调用 renderer 侧已注册的 API。
 */
@injectable()
export default class RendererGatewayImpl implements RendererGateway {
    @inject(TYPES.MainWindowRegistry)
    private mainWindowRegistry!: MainWindowRegistry;

    private logger = getMainLogger('RendererGateway');
    private callIdCounter = 0;

    /**
     * 调用当前 renderer 已注册的 API，并记录完整的发送、回执和超时生命周期。
     *
     * @param path renderer API 路径。
     * @param params 传递给 renderer handler 的参数。
     * @returns renderer handler 的返回值。
     */
    public async call<K extends keyof RendererApiDefinitions>(
        path: K,
        params: RendererApiDefinitions[K]['params'],
    ): Promise<RendererApiDefinitions[K]['return']> {
        const mainWindow = this.mainWindowRegistry.tryGetMainWindow();
        if (!mainWindow) {
            throw new Error('Main window is not available');
        }

        const callId = `${String(path)}-${++this.callIdCounter}-${Date.now()}`;
        const startedAt = Date.now();

        return new Promise<RendererApiDefinitions[K]['return']>((resolve, reject) => {
            const eventName = `renderer-api-response-${callId}`;
            let settled = false;

            const settle = (
                callback: () => void,
                outcome: 'succeeded' | 'failed' | 'timed-out'
            ): void => {
                if (settled) {
                    return;
                }
                settled = true;
                clearTimeout(timeoutId);
                ipcMain.removeListener(eventName, responseListener);
                this.logger[outcome === 'succeeded' ? 'info' : 'warn']('renderer api call settled', {
                    path,
                    callId,
                    outcome,
                    elapsedMs: Date.now() - startedAt,
                });
                callback();
            };

            const responseListener = (_event: unknown, response: {
                success: boolean;
                result?: RendererApiDefinitions[K]['return'];
                error?: string;
            }): void => {
                if (response?.success) {
                    settle(() => resolve(response.result), 'succeeded');
                } else {
                    settle(() => reject(new Error(response?.error || 'Unknown error')), 'failed');
                }
            };

            const timeoutId = setTimeout(() => {
                settle(
                    () => reject(new Error(`Renderer API response timed out after ${RENDERER_API_RESPONSE_TIMEOUT_MS}ms`)),
                    'timed-out'
                );
            }, RENDERER_API_RESPONSE_TIMEOUT_MS);

            ipcMain.once(eventName, responseListener);
            this.logger.info('renderer api call dispatched', {
                path,
                callId,
                webContentsId: mainWindow.webContents.id,
            });

            try {
                mainWindow.webContents.send(`renderer-api-call-${path}`, callId, params);
            } catch (error) {
                settle(
                    () => reject(error),
                    'failed'
                );
            }
        });
    }

    /**
     * 异步通知 renderer；失败仅记录日志，不阻塞调用方业务流程。
     *
     * @param path renderer API 路径。
     * @param params 传递给 renderer handler 的参数。
     */
    public fireAndForget<K extends keyof RendererApiDefinitions>(
        path: K,
        params: RendererApiDefinitions[K]['params'],
    ): void {
        this.call(path, params).catch((error) => {
            this.logger.warn('renderer api call failed', {
                path,
                error: error instanceof Error ? error.message : String(error),
            });
        });
    }
}
