import { ipcMain } from 'electron';
import util from 'util';

import { ApiMap } from '@/common/api/api-def';
import SystemService from '@/backend/application/services/SystemService';
import container from '@/backend/ioc/inversify.config';
import TYPES from '@/backend/ioc/types';
import { getMainLogger } from '@/backend/ioc/simple-logger';

const logger = getMainLogger('ipc');

const SENSITIVE_KEY_RE = /(apiKey|accessKey|secret|token|password|authorization|cookie)/i;

function sanitize(value: unknown, depth = 0): unknown {
    const maxDepth = 4;
    const maxKeys = 40;
    const maxArray = 40;

    if (value === null || value === undefined) return value;
    if (typeof value === 'string') return value.length > 400 ? `${value.slice(0, 400)}…` : value;
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
            if (SENSITIVE_KEY_RE.test(key)) {
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

export default function registerRoute<K extends keyof ApiMap>(path: K, func: ApiMap[K]) {
    ipcMain.handle(path, async (_event, param) => {
        const start = Date.now();
        logger.info(`api-call path=${String(path)} param=${preview(param)}`);

        try {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            const result = await func(param);
            const costMs = Date.now() - start;
            logger.info(`api-ok path=${String(path)} costMs=${costMs} result=${preview(result)}`);
            return result;
        } catch (error) {
            const costMs = Date.now() - start;
            const message = error instanceof Error ? error.message : String(error);
            logger.error(`api-error path=${String(path)} costMs=${costMs} message=${preview(message, 300)}`, { error });
            container.get<SystemService>(TYPES.SystemService).sendErrorToRenderer(
                error instanceof Error ? error : new Error(String(error)),
            );
            throw error;
        }
    });
}
