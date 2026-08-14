import { ipcMain } from 'electron';

import { ApiMap } from '@/common/api/api-def';
import container from '@/backend/ioc/inversify.config';
import TYPES from '@/backend/ioc/types';
import { getMainLogger, resolveTraceId, runWithTrace } from '@/backend/infrastructure/logger';
import RendererEvents from '@/backend/application/ports/gateways/renderer/RendererEvents';
import type { TraceCarrier } from '@/common/log/simple-types';

const logger = getMainLogger('ipc');

/** 高频/敏感路径的日志策略：降为 debug，并按需跳过 param/result，避免噪音与密钥落盘。 */
const QUIET_PATH_POLICIES: Partial<Record<string, { logParam: boolean; logResult: boolean }>> = {
    'watch-history/progress/update': { logParam: false, logResult: false },
    'storage/get': { logParam: true, logResult: false },
};

/**
 * 判断异常是否为用户主动取消（axios CanceledError / AbortError / 取消语义消息）。
 * @param error 捕获到的未知异常。
 * @returns 属于用户主动取消时返回 true。
 * 取消属预期行为，不应按 error 记录。
 */
function isUserCancellation(error: unknown): boolean {
    if (!(error instanceof Error)) {
        return false;
    }
    return error.name === 'CanceledError'
        || error.name === 'AbortError'
        || /cancel|取消/i.test(error.message);
}

/**
 * 注册 IPC 路由并统一记录调用日志。
 *
 * 行为说明：
 * - renderer 提供合法 trace ID 时沿用，否则在 main 边界生成；
 * - 普通路径在 info 级记录 param/result，统一日志出口负责脱敏与裁剪；
 * - 命中 QUIET_PATH_POLICIES 的高频/敏感路径降为 debug，并按策略跳过 param/result，避免噪音与密钥落盘；
 * - 异常统一记 error，并转发给渲染端事件总线。
 * @param path API 路径。
 * @param func 与路径匹配的处理函数。
 */
export default function registerRoute<K extends keyof ApiMap>(path: K, func: ApiMap[K]) {
    ipcMain.handle(path, async (_event, param, traceCarrier?: TraceCarrier) => {
        const traceId = resolveTraceId(traceCarrier?.traceId);
        return runWithTrace(traceId, async () => {
            const start = Date.now();
            const policy = QUIET_PATH_POLICIES[path];
            const requestData = policy?.logParam === false
                ? { path: String(path) }
                : { path: String(path), param };

            if (policy) {
                logger.debug('ipc request started', requestData);
            } else {
                logger.info('ipc request started', requestData);
            }

            try {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                const result = await func(param);
                const responseData = policy?.logResult === false
                    ? { path: String(path), durationMs: Date.now() - start }
                    : { path: String(path), durationMs: Date.now() - start, result };
                if (policy) {
                    logger.debug('ipc request completed', responseData);
                } else {
                    logger.info('ipc request completed', responseData);
                }
                return result;
            } catch (error) {
                const errorData = {
                    path: String(path),
                    durationMs: Date.now() - start,
                    error,
                };
                if (isUserCancellation(error)) {
                    logger.warn('ipc request cancelled', errorData);
                } else {
                    logger.error('ipc request failed', errorData);
                }
                container
                    .get<RendererEvents>(TYPES.RendererEvents)
                    .error(error instanceof Error ? error : new Error(String(error)));
                throw error;
            }
        });
    });
}
