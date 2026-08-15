import fs from 'fs';
import path from 'path';
import util from 'util';
import { app } from 'electron';
import log from 'electron-log/main';

import { isSensitiveKey, maskSensitiveValues } from '@/common/log/mask';
import { SimpleEvent, SimpleLevel } from '@/common/log/simple-types';
import { AppStateDirectoryType, getAppStatePath } from '@/backend/infrastructure/system/AppStatePath';
import { isDevelopmentMode } from '@/backend/utils/runtimeEnv';
import { getCurrentTraceId, isTraceId } from './trace-context';

/** 写入 JSON Lines 文件的稳定日志结构。 */
interface JsonLogRecord {
    /** 日志结构版本，便于分析脚本处理未来演进。 */
    schemaVersion: 1;
    /** 产生日志时运行的软件版本。 */
    appVersion: string;
    /** 事件发生时间，ISO 8601 格式。 */
    timestamp: string;
    /** 日志级别。 */
    level: SimpleLevel;
    /** 产生日志的 Electron 进程。 */
    process: 'main' | 'renderer';
    /** 组件、类或文件的稳定名称。 */
    module: string;
    /** 简短、可检索的事件描述。 */
    message: string;
    /** 可选的跨异步调用链追踪标识。 */
    traceId?: string;
    /** 已脱敏和裁剪的结构化上下文。 */
    data?: unknown;
}

/** 日志器公开能力；`withTrace` 用于脱离自动异步上下文的显式追踪。 */
export interface MainLogger {
    debug: (msg: string, data?: unknown) => void;
    info: (msg: string, data?: unknown) => void;
    warn: (msg: string, data?: unknown) => void;
    error: (msg: string, data?: unknown) => void;
    withTrace: (traceId: string) => MainLogger;
}

const logPath = getAppStatePath(AppStateDirectoryType.LOGS);
const MAX_DATA_DEPTH = 5;
const MAX_OBJECT_KEYS = 50;
const MAX_ARRAY_ITEMS = 50;
const MAX_STRING_LENGTH = 4000;

if (!fs.existsSync(logPath)) {
    fs.mkdirSync(logPath, { recursive: true });
}

/**
 * 计算当天 JSON Lines 日志文件路径。
 * @returns main-YYYY-MM-DD.jsonl 形式的绝对路径。
 */
function todayFile(): string {
    const date = new Date();
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return path.join(logPath, `main-${day}.jsonl`);
}

/**
 * 将 electron-log 自身捕获的异常也包装成合法 JSON，保证文件每一行都可独立解析。
 * @param data electron-log 收到的原始参数。
 * @param level electron-log 日志级别。
 * @param timestamp 日志发生时间。
 * @returns 单行 JSON 字符串。
 */
function formatTransportLine(data: unknown[], level: string, timestamp: Date): string {
    if (data.length === 1 && typeof data[0] === 'string') {
        try {
            const parsed = JSON.parse(data[0]) as Partial<JsonLogRecord>;
            if (parsed.schemaVersion === 1
                && typeof parsed.appVersion === 'string'
                && typeof parsed.timestamp === 'string'
                && typeof parsed.module === 'string'
                && typeof parsed.message === 'string') {
                return data[0];
            }
        } catch {
            // 非结构化的 electron-log 内部消息在下面统一包装。
        }
    }

    const sanitizedData = sanitizeValue(data);
    return JSON.stringify({
        schemaVersion: 1,
        appVersion: app.getVersion(),
        timestamp: timestamp.toISOString(),
        level: normalizeLevel(level) ?? 'error',
        process: 'main',
        module: 'electron-log',
        message: maskSensitiveValues(util.format(...(sanitizedData as unknown[]))),
        data: sanitizedData,
    } satisfies JsonLogRecord);
}

/**
 * 将结构化日志压缩为适合开发控制台阅读的单行文本。
 * @param data electron-log 收到的原始参数。
 * @param level electron-log 日志级别。
 * @param message electron-log 的日志消息元数据。
 * @returns 控制台 transport 要输出的单行文本数组。
 */
function formatConsoleLine({
    data,
    level,
    message,
}: {
    data: unknown[];
    level: string;
    message: { date: Date };
}): string[] {
    const date = message.date;
    const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
    const levelText = level.toUpperCase().padEnd(5, ' ');
    const rawMessage = data.length === 1 && typeof data[0] === 'string'
        ? data[0]
        : util.format(...data);

    try {
        const record = JSON.parse(rawMessage) as Partial<JsonLogRecord>;
        if (record.schemaVersion === 1
            && typeof record.process === 'string'
            && typeof record.module === 'string'
            && typeof record.message === 'string') {
            const context = record.data === undefined ? '' : ` ${JSON.stringify(record.data)}`;
            const line = `${time} ${levelText} [${record.process}/${record.module}] ${record.message}${context}`;
            return [`${line.slice(0, 1200)}${line.length > 1200 ? '…' : ''}`];
        }
    } catch {
        // 非结构化消息直接按 electron-log 原始内容输出。
    }

    return [`${time} ${levelText} ${rawMessage}`];
}

log.initialize({ preload: true });
log.transports.file.resolvePathFn = todayFile;
log.transports.file.level = 'silly';
log.transports.file.format = ({ data, level, message }) => [
    formatTransportLine(data, level, message.date),
];
log.transports.console.level = isDevelopmentMode() ? 'silly' : 'warn';
log.transports.console.format = formatConsoleLine;
log.errorHandler.startCatching();

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
function normalizeLevel(level: string | undefined): SimpleLevel | null {
    if (level === 'debug' || level === 'info' || level === 'warn' || level === 'error') {
        return level;
    }
    return null;
}

/**
 * 获取当前运行模式对应的默认日志级别。
 * @returns 配置值，或开发环境 debug、生产环境 info。
 */
function defaultLevel(): SimpleLevel {
    const envLevel = normalizeLevel(process.env.DP_LOG_LEVEL);
    if (envLevel) {
        return envLevel;
    }
    return isDevelopmentMode() ? 'debug' : 'info';
}

let CURRENT_LEVEL: SimpleLevel = defaultLevel();

/**
 * 动态调整 main 进程日志级别。
 * @param level 新的最低日志级别。
 */
export function setLogLevel(level: SimpleLevel): void {
    CURRENT_LEVEL = level;
}

/**
 * 判断指定级别是否达到当前输出阈值。
 * @param level 待判断日志级别。
 * @returns 应输出时返回 true。
 */
function shouldLog(level: SimpleLevel): boolean {
    return levelOrder[level] >= levelOrder[CURRENT_LEVEL];
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

const INCLUDE_MODULE_FILTER = createModuleFilterSet(process.env.DP_LOG_INCLUDE_MODULES);
const EXCLUDE_MODULE_FILTER = createModuleFilterSet(process.env.DP_LOG_EXCLUDE_MODULES);

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
 * 将任意值转换为可 JSON 序列化、已脱敏且有界的结构。
 * @param value 原始日志数据。
 * @param depth 当前递归深度。
 * @param seen 已访问对象集合，用于识别循环引用。
 * @returns 可安全写入日志的值。
 */
function sanitizeValue(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
    if (value === null || value === undefined || typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : String(value);
    }
    if (typeof value === 'string') {
        const masked = maskSensitiveValues(value);
        return masked.length > MAX_STRING_LENGTH ? `${masked.slice(0, MAX_STRING_LENGTH)}…` : masked;
    }
    if (typeof value === 'bigint') {
        return value.toString();
    }
    if (typeof value === 'function' || typeof value === 'symbol') {
        return String(value);
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    if (depth >= MAX_DATA_DEPTH) {
        return '[MaxDepth]';
    }
    if (value instanceof Error) {
        if (seen.has(value)) {
            return '[Circular Error]';
        }
        seen.add(value);
        return {
            name: value.name,
            message: sanitizeValue(value.message, depth + 1, seen),
            stack: sanitizeValue(value.stack, depth + 1, seen),
            cause: sanitizeValue(value.cause, depth + 1, seen),
        };
    }
    if (typeof value !== 'object') {
        return String(value);
    }
    if (seen.has(value)) {
        return '[Circular]';
    }
    seen.add(value);

    if (Array.isArray(value)) {
        const items = value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeValue(item, depth + 1, seen));
        if (value.length > MAX_ARRAY_ITEMS) {
            items.push(`[Truncated ${value.length - MAX_ARRAY_ITEMS} items]`);
        }
        return items;
    }

    try {
        const entries = Object.entries(value as Record<string, unknown>);
        const output: Record<string, unknown> = {};
        for (const [key, item] of entries.slice(0, MAX_OBJECT_KEYS)) {
            output[key] = isSensitiveKey(key) ? '***' : sanitizeValue(item, depth + 1, seen);
        }
        if (entries.length > MAX_OBJECT_KEYS) {
            output.__truncatedKeys = entries.length - MAX_OBJECT_KEYS;
        }
        return output;
    } catch {
        return '[Unserializable]';
    }
}

/**
 * 将跨进程事件转换为稳定的 JSON 日志结构。
 * @param event 原始日志事件。
 * @returns 已规范化的日志记录。
 */
function createRecord(event: SimpleEvent): JsonLogRecord {
    const record: JsonLogRecord = {
        schemaVersion: 1,
        appVersion: app.getVersion(),
        timestamp: event.ts || new Date().toISOString(),
        level: event.level,
        process: event.process,
        module: event.module,
        message: maskSensitiveValues(event.msg),
    };
    if (isTraceId(event.traceId)) {
        record.traceId = event.traceId;
    }
    if (event.data !== undefined) {
        record.data = sanitizeValue(event.data);
    }
    return record;
}

/**
 * 将日志事件写入对应 transport。
 * @param event 原始日志事件；调用方需提供明确的进程、模块和级别。
 */
export function writeEvent(event: SimpleEvent): void {
    if (!shouldLog(event.level) || !shouldLogModule(event.module)) {
        return;
    }

    const line = JSON.stringify(createRecord(event));
    log[event.level](line);
}

/**
 * 在 main 进程创建并写入日志事件。
 * @param moduleName 日志模块名。
 * @param level 日志级别。
 * @param msg 事件描述。
 * @param data 可选结构化上下文。
 * @param traceId 显式 trace ID；未提供时读取当前异步上下文。
 */
function logAt(moduleName: string, level: SimpleLevel, msg: string, data?: unknown, traceId?: string): void {
    writeEvent({
        ts: new Date().toISOString(),
        level,
        process: 'main',
        module: moduleName,
        msg,
        data,
        traceId: traceId ?? getCurrentTraceId(),
    });
}

/**
 * 创建指定模块的 main 进程日志器。
 * @param moduleName 稳定模块名。
 * @param traceId 可选的显式 trace ID。
 * @returns 可复用日志器。
 */
function createLogger(moduleName: string, traceId?: string): MainLogger {
    return {
        debug: (msg, data) => logAt(moduleName, 'debug', msg, data, traceId),
        info: (msg, data) => logAt(moduleName, 'info', msg, data, traceId),
        warn: (msg, data) => logAt(moduleName, 'warn', msg, data, traceId),
        error: (msg, data) => logAt(moduleName, 'error', msg, data, traceId),
        withTrace: (nextTraceId) => createLogger(moduleName, nextTraceId),
    };
}

/**
 * 获取指定模块的 main 进程日志器。
 * @param moduleName 稳定模块名。
 * @returns 可复用日志器；默认自动读取当前 trace 上下文。
 */
export function getMainLogger(moduleName: string): MainLogger {
    return createLogger(moduleName);
}

/**
 * 删除超过保留期的新旧格式日志文件。
 * @param days 保留天数，默认 14 天。
 */
export function pruneOldLogs(days = 14): void {
    const keepMs = days * 24 * 60 * 60 * 1000;
    const now = Date.now();

    try {
        const files = fs.readdirSync(logPath);
        files.forEach((file) => {
            if (!/^main-\d{4}-\d{2}-\d{2}(?:\.old)?\.(?:jsonl|log)$/.test(file)) return;
            const fullPath = path.join(logPath, file);
            const fileStat = fs.statSync(fullPath);
            if (now - fileStat.mtimeMs > keepMs) fs.unlinkSync(fullPath);
        });
    } catch (error) {
        getMainLogger('logger-prune').error('prune old logs failed', { error });
    }
}

setInterval(() => pruneOldLogs(), 24 * 60 * 60 * 1000).unref();
