import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import RendererGateway from '@/backend/application/ports/gateways/renderer/RendererGateway';
import { RendererApiDefinitions } from '@/common/api/renderer-api-def';
import { getMainLogger } from '@/backend/infrastructure/logger';
import MainWindowRegistry from '@/backend/infrastructure/system/MainWindowRegistry';
import { ipcMain } from 'electron';

@injectable()
export default class RendererGatewayImpl implements RendererGateway {
    @inject(TYPES.MainWindowRegistry)
    private mainWindowRegistry!: MainWindowRegistry;

    private logger = getMainLogger('RendererGateway');
    private callIdCounter = 0;

    public async call<K extends keyof RendererApiDefinitions>(
        path: K,
        params: RendererApiDefinitions[K]['params'],
    ): Promise<RendererApiDefinitions[K]['return']> {
        const mainWindow = this.mainWindowRegistry.tryGetMainWindow();
        if (!mainWindow) {
            throw new Error('Main window is not available');
        }

        const callId = `${String(path)}-${++this.callIdCounter}-${Date.now()}`;

        return new Promise<RendererApiDefinitions[K]['return']>((resolve, reject) => {
            const eventName = `renderer-api-response-${callId}`;

            ipcMain.once(eventName, (_event: unknown, response: any) => {
                if (response?.success) {
                    resolve(response.result);
                } else {
                    reject(new Error(response?.error || 'Unknown error'));
                }
            });

            mainWindow.webContents.send(`renderer-api-call-${path}`, callId, params);
        });
    }

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
