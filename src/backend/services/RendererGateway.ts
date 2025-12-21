import { RendererApiDefinitions } from '@/common/api/renderer-api-def';

export default interface RendererGateway {
    call<K extends keyof RendererApiDefinitions>(
        path: K,
        params: RendererApiDefinitions[K]['params'],
    ): Promise<RendererApiDefinitions[K]['return']>;

    fireAndForget<K extends keyof RendererApiDefinitions>(
        path: K,
        params: RendererApiDefinitions[K]['params'],
    ): void;
}

