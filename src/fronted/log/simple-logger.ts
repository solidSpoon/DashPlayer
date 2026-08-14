import type { SimpleLevel } from '@/common/log/simple-types';
import { logWriter } from '@/fronted/application/bootstrap/logWriter';

/** renderer 日志器；显式 `withTrace` 可关联已知的跨进程调用链。 */
interface RendererLogger {
    debug: (msg: string, data?: unknown) => void;
    info: (msg: string, data?: unknown) => void;
    warn: (msg: string, data?: unknown) => void;
    error: (msg: string, data?: unknown) => void;
    withTrace: (traceId: string) => RendererLogger;
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

/**
 * 解析逗号分隔的模块过滤配置。
 * @param input 环境变量原始值。
 * @returns 去除空白和空项后的模块名。
 */
function normalizeCsvInput(input?: string): string[] {
    if (!input) return [];
    return input.split(',').map((item) => item.trim()).filter(Boolean);
}

/**
 * 创建模块过滤集合。
 * @param input 逗号分隔的模块名。
 * @returns 模块集合；未配置时返回 null。
 */
function createModuleFilterSet(input?: string): Set<string> | null {
    const modules = normalizeCsvInput(input);
    return modules.length > 0 ? new Set(modules) : null;
}

const CURRENT_LEVEL = getDefaultLevel();
const INCLUDE_MODULE_FILTER = createModuleFilterSet(import.meta.env.VITE_DP_LOG_INCLUDE_MODULES);
const EXCLUDE_MODULE_FILTER = createModuleFilterSet(import.meta.env.VITE_DP_LOG_EXCLUDE_MODULES);
const RENDERER_LOGGER_CACHE = new Map<string, RendererLogger>();

/**
 * 判断模块是否通过 allowlist/denylist。
 * @param moduleName 日志模块名。
 * @returns 应输出时返回 true。
 */
function shouldLogModule(moduleName: string): boolean {
    if (INCLUDE_MODULE_FILTER && !INCLUDE_MODULE_FILTER.has(moduleName)) {
        return false;
    }
    if (EXCLUDE_MODULE_FILTER && EXCLUDE_MODULE_FILTER.has(moduleName)) {
        return false;
    }
    return true;
}

/**
 * 输出 renderer 日志到开发控制台并发送给 main 进程落盘。
 * @param moduleName 日志模块名。
 * @param level 日志级别。
 * @param msg 事件描述。
 * @param data 可选结构化上下文。
 * @param traceId 可选 trace ID。
 */
function write(moduleName: string, level: SimpleLevel, msg: string, data?: unknown, traceId?: string): void {
    if (import.meta.env.DEV) {
        const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : level === 'debug' ? 'debug' : 'log';
        // eslint-disable-next-line no-console
        console[method](`[renderer|${moduleName}|${level}]`, msg, data ?? '');
    }

    try {
        logWriter.write({
            ts: new Date().toISOString(),
            level,
            process: 'renderer',
            module: moduleName,
            msg,
            data,
            traceId,
        });
    } catch {
        // renderer 日志失败不能反向打断用户操作。
    }
}

/**
 * 创建 renderer 日志器。
 * @param moduleName 稳定模块名。
 * @param traceId 可选的显式 trace ID。
 * @returns 可复用日志器。
 */
function createLogger(moduleName: string, traceId?: string): RendererLogger {
    const at = (level: SimpleLevel, msg: string, data?: unknown): void => {
        if (levelOrder[level] < levelOrder[CURRENT_LEVEL] || !shouldLogModule(moduleName)) {
            return;
        }
        write(moduleName, level, msg, data, traceId);
    };

    return {
        debug: (msg, data) => at('debug', msg, data),
        info: (msg, data) => at('info', msg, data),
        warn: (msg, data) => at('warn', msg, data),
        error: (msg, data) => at('error', msg, data),
        withTrace: (nextTraceId) => createLogger(moduleName, nextTraceId),
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
