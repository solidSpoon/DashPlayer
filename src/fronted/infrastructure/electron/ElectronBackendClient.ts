import BackendClientPort from '@/fronted/application/ports/backend/BackendClientPort';
import { ApiDefinitions, ApiMap } from '@/common/api/api-def';

export class ElectronBackendClient implements BackendClientPort {
    call<K extends keyof ApiMap>(
        path: K,
        params?: ApiDefinitions[K]['params'],
    ): Promise<ApiDefinitions[K]['return']> {
        return window.electron.call(path, params);
    }

    safeCall<K extends keyof ApiMap>(
        path: K,
        params?: ApiDefinitions[K]['params'],
    ): Promise<ApiDefinitions[K]['return'] | null> {
        return window.electron.safeCall(path, params);
    }
}

