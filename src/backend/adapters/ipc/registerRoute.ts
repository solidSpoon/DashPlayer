import { ipcMain } from 'electron';
import util from 'util';

import { ApiMap } from '@/common/api/api-def';
import container from '@/backend/ioc/inversify.config';
import TYPES from '@/backend/ioc/types';
import { getMainLogger } from '@/backend/infrastructure/logger';
import RendererEvents from '@/backend/application/ports/gateways/renderer/RendererEvents';
import { isSensitiveKey, maskSensitiveValues } from '@/common/log/mask';

const logger = getMainLogger('ipc');

/** 高频/敏感路径的日志策略：降为 debug，并按需跳过 param/result，避免噪音与密钥落盘。 */
const QUIET_PATH_POLICIES: Partial<Record<string, { logParam: boolean; logResult: boolean }>> = {
    'watch-history/progress/update': { logParam: false, logResult: false },
    'storage/get': { logParam: true, logResult: false },
};

/**
 * 递归脱敏对象，用于日志预览前的安全化处理。
 *
 * 行为说明：
 * - 命中敏感字段名（含独立 key 字段）整体替换为 '***'；
 * - 字符串值先做 sk-/Bearer 模式掩码，再做 400 字符截断；
 * - 深度超过 4 层、对象键超过 40 个、数组超过 40 项时截断为占位，防止日志膨胀。
 */
function sanitize(value: unknown, depth = 0): unknown {
    const maxDepth = 4;
    const maxKeys = 40;
    const maxArray = 40;

    if (value === null || value === undefined) return value;
    if (typeof value === 'string') {
        const masked = maskSensitiveValues(value);
        return masked.length > 400 ? `${masked.slice(0, 400)}…` : masked;
    }
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value === 'bigint') return value.toString();
    if (value instanceof Error) return { name: value.name, message: value.message };

    if (depth >= maxDepth) return '[MaxDepth]';

    if (Array.isArray(value)) {
        return value.slice(0, maxArray).map((v) => sanitize(v, depth + 1));
    }

    if (typeof value === 'object') {
        const out: Record<string, unknown> = {};
        const entries = Object.entries(value as Record<string, unknown>).slice(0, maxKeys);
        for (const [key, val] of entries) {
            if (isSensitiveKey(key)) {
                out[key] = '***';
            } else {
                out[key] = sanitize(val, depth + 1);
            }
        }
        return out;
    }

    return String(value);
}

function toSingleLine(text: string) {
    return text.replaceAll('\n', ' | ').replaceAll('\r', '');
}

function preview(value: unknown, maxLen = 800) {
    try {
        const inspected = util.inspect(sanitize(value), {
            depth: 4,
            breakLength: Infinity,
            compact: true,
            maxArrayLength: 40,
            maxStringLength: 400,
        });
        const single = toSingleLine(inspected);
        return single.length > maxLen ? `${single.slice(0, maxLen)}…` : single;
    } catch {
        return '[Unserializable]';
    }
}

/**
 * 注册 IPC 路由并统一记录调用日志。
 *
 * 行为说明：
 * - 普通路径在 info 级记录 param/result（已脱敏）；
 * - 命中 QUIET_PATH_POLICIES 的高频/敏感路径降为 debug，并按策略跳过 param/result，避免噪音与密钥落盘；
 * - 异常统一记 error，并转发给渲染端事件总线。
 */
export default function registerRoute<K extends keyof ApiMap>(path: K, func: ApiMap[K]) {
    ipcMain.handle(path, async (_event, param) => {
        const start = Date.now();
        const policy = QUIET_PATH_POLICIES[path];
        if (policy) {
            logger.debug(`api-call path=${String(path)}${policy.logParam ? ` param=${preview(param)}` : ''}`);
        } else {
            logger.info(`api-call path=${String(path)} param=${preview(param)}`);
        }

        try {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            const result = await func(param);
            const costMs = Date.now() - start;
            if (policy) {
                logger.debug(`api-ok path=${String(path)} costMs=${costMs}${policy.logResult ? ` result=${preview(result)}` : ''}`);
            } else {
                logger.info(`api-ok path=${String(path)} costMs=${costMs} result=${preview(result)}`);
            }
            return result;
        } catch (error) {
            const costMs = Date.now() - start;
            const message = error instanceof Error ? error.message : String(error);
            logger.error(`api-error path=${String(path)} costMs=${costMs} message=${preview(message, 300)}`, { error });
            container
                .get<RendererEvents>(TYPES.RendererEvents)
                .error(error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    });
}
