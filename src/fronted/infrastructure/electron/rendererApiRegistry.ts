import { RendererApiMap } from '@/common/api/renderer-api-def';

/**
 * 注册供 main 进程调用的 renderer 接口。
 *
 * @param path renderer 接口路径。
 * @param handler 接口处理函数。
 * @returns 取消注册函数。
 */
export function registerRendererApi<K extends keyof RendererApiMap>(
    path: K,
    handler: RendererApiMap[K],
): () => void {
    if (!window.electron.registerRendererApi) {
        throw new Error('window.electron.registerRendererApi is not available');
    }

    return window.electron.registerRendererApi(path, handler);
}
