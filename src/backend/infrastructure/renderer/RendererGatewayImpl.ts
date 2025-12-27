import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import SystemService from '@/backend/application/services/SystemService';
import RendererGateway from '@/backend/infrastructure/renderer/RendererGateway';
import { RendererApiDefinitions } from '@/common/api/renderer-api-def';
import { getMainLogger } from '@/backend/ioc/simple-logger';

@injectable()
export default class RendererGatewayImpl implements RendererGateway {
    @inject(TYPES.SystemService)
    private systemService!: SystemService;

    private logger = getMainLogger('RendererGateway');

    public async call<K extends keyof RendererApiDefinitions>(
        path: K,
        params: RendererApiDefinitions[K]['params'],
    ): Promise<RendererApiDefinitions[K]['return']> {
        return this.systemService.callRendererApi(path, params);
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
