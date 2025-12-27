import { ApiDefinitions, ApiMap } from '@/common/api/api-def';

export default interface BackendClientPort {
    call<K extends keyof ApiMap>(
        path: K,
        params?: ApiDefinitions[K]['params'],
    ): Promise<ApiDefinitions[K]['return']>;

    safeCall<K extends keyof ApiMap>(
        path: K,
        params?: ApiDefinitions[K]['params'],
    ): Promise<ApiDefinitions[K]['return'] | null>;
}

