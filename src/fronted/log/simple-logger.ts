import type { SimpleLevel } from '@/common/log/simple-types';
import { writeRendererLog } from '@/fronted/infrastructure/electron/logWriter';

/** renderer 日志器；跨进程关联由 IPC 边界自动附加的 trace ID 负责。 */
export interface RendererLogger {
    debug: (msg: string, data?: unknown) => void;
    info: (msg: string, data?: unknown) => void;
    warn: (msg: string, data?: unknown) => void;
    error: (msg: string, data?: unknown) => void;
}

const levelOrder: Record<SimpleLevel, number> = {
    debug: 20,
    info: 30,
    warn: 40,
    error: 50,
};

/**
 * 将环境变量中的日志级别解析为受支持值。
 * @param level 候选日志级别。
 * @returns 合法级别；无法识别时返回 null。
 */
function normalizeLevel(level?: string): SimpleLevel | null {
    if (level === 'debug' || level === 'info' || level === 'warn' || level === 'error') {
        return level;
    }
    return null;
}

/**
 * 获取 renderer 的默认日志级别。
 * @returns Vite 配置值；未配置时返回 info。
 */
function getDefaultLevel(): SimpleLevel {
    return normalizeLevel(import.meta.env.VITE_DP_LOG_LEVEL) ?? 'info';
}

const CURRENT_LEVEL = getDefaultLevel();
const RENDERER_LOGGER_CACHE = new Map<string, RendererLogger>();

/**
 * 输出 renderer 日志到开发控制台并发送给 main 进程落盘。
 * @param moduleName 日志模块名。
 * @param level 日志级别。
 * @param msg 事件描述。
 * @param data 可选结构化上下文。
 */
function write(moduleName: string, level: SimpleLevel, msg: string, data?: unknown): void {
    if (import.meta.env.DEV) {
        const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : level === 'debug' ? 'debug' : 'log';
        // eslint-disable-next-line no-console
        console[method](`[renderer|${moduleName}|${level}]`, msg, data ?? '');
    }

    try {
        writeRendererLog({
            ts: new Date().toISOString(),
            level,
            process: 'renderer',
            module: moduleName,
            msg,
            data,
        });
    } catch (error) {
        // 日志通道故障必须显式可见，否则整条证据链会静默断裂；仍不向上抛以免打断用户操作。
        // eslint-disable-next-line no-console
        console.error(`[dp-log] renderer log write failed (module=${moduleName}, msg=${msg})`, error);
    }
}

/**
 * 创建 renderer 日志器。
 * @param moduleName 稳定模块名。
 * @returns 可复用日志器。
 */
function createLogger(moduleName: string): RendererLogger {
    const at = (level: SimpleLevel, msg: string, data?: unknown): void => {
        if (levelOrder[level] < levelOrder[CURRENT_LEVEL]) {
            return;
        }
        write(moduleName, level, msg, data);
    };

    return {
        debug: (msg, data) => at('debug', msg, data),
        info: (msg, data) => at('info', msg, data),
        warn: (msg, data) => at('warn', msg, data),
        error: (msg, data) => at('error', msg, data),
    };
}

/**
 * 获取指定模块的 renderer 日志器。
 * @param moduleName 稳定模块名。
 * @returns 可复用日志器。
 */
export function getRendererLogger(moduleName: string): RendererLogger {
    const cached = RENDERER_LOGGER_CACHE.get(moduleName);
    if (cached) return cached;

    const logger = createLogger(moduleName);
    RENDERER_LOGGER_CACHE.set(moduleName, logger);
    return logger;
}
