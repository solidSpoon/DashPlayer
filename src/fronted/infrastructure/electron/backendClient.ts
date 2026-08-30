import { ApiDefinitions, ApiMap } from '@/common/api/api-def';

/**
 * renderer 调用 main 进程后端接口的统一入口。
 */
export const backendClient = {
    /**
     * 调用后端接口，失败时由调用方处理异常。
     *
     * @param path 后端接口路径。
     * @param params 接口参数。
     * @returns 后端接口返回值。
     */
    call<K extends keyof ApiMap>(
        path: K,
        params?: ApiDefinitions[K]['params'],
    ): Promise<ApiDefinitions[K]['return']> {
        return window.electron.call(path, params);
    },
};
