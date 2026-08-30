import fs from 'fs';
import path from 'path';
import util from 'util';
import { app } from 'electron';
import log from 'electron-log/main';

import { isSensitiveKey, maskSensitiveValues } from '@/common/log/mask';
import { SimpleEvent, SimpleLevel } from '@/common/log/simple-types';
import { AppStateDirectoryType, getAppStatePath } from '@/backend/infrastructure/system/AppStatePath';
import { isDevelopmentMode } from '@/backend/utils/runtimeEnv';
import { createTraceId, getCurrentTraceId, isTraceId } from './trace-context';

/** 写入 JSON Lines 文件的稳定日志结构。 */
interface JsonLogRecord {
    /** 日志结构版本，便于分析脚本处理未来演进。 */
    schemaVersion: 1;
    /** 产生日志时运行的软件版本。 */
    appVersion: string;
    /**
     * 一次应用生命周期的标识。
     * 崩溃循环会把多次启动写进同一天的同一个文件，只靠时间戳无法切分"哪一段属于本次故障"。
     * renderer 日志统一由 main 落盘，因此 renderer 记录的 runId 与 pid 都表示主进程侧的会话。
     */
    runId: string;
    /** 主进程号，用于把日志与系统层进程事件（崩溃、被 kill）对齐。 */
    pid: number;
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

/** 日志器公开能力；trace ID 由异步上下文自动附带，无需显式传入。 */
export interface MainLogger {
    debug: (msg: string, data?: unknown) => void;
    info: (msg: string, data?: unknown) => void;
    warn: (msg: string, data?: unknown) => void;
    error: (msg: string, data?: unknown) => void;
}

const logPath = getAppStatePath(AppStateDirectoryType.LOGS);
const MAX_DATA_DEPTH = 5;
const MAX_OBJECT_KEYS = 50;
const MAX_ARRAY_ITEMS = 50;
const MAX_STRING_LENGTH = 4000;

/** 单个日志文件的上限，超过即归档；electron-log 默认的 1 MiB 在开发级日志下几分钟就会翻档。 */
const LOG_FILE_MAX_BYTES = 4 * 1024 * 1024;
/** 日志目录总容量预算，超出后按修改时间升序删除已归档文件。 */
const LOG_DIR_BUDGET_BYTES = 128 * 1024 * 1024;
/** 日志文件保留天数。 */
const LOG_RETENTION_DAYS = 14;
/** 日志文件名前缀，扩展名统一为 .jsonl。 */
const LOG_FILE_PREFIX = 'main';
/**
 * 匹配全部受管日志文件名：当天主文件 `main-YYYY-MM-DD.jsonl`、归档 `main-YYYY-MM-DD.<seq>.jsonl`，
 * 以及历史遗留的 `main-YYYY-MM-DD.old.jsonl`（旧归档策略的产物）。
 */
const LOG_FILE_PATTERN = /^main-\d{4}-\d{2}-\d{2}(?:\.\d+)?(?:\.old)?\.(?:jsonl|log)$/;

/**
 * 本次应用生命周期的标识。
 * 与 trace ID 同构，便于分析脚本用同一套 32 位十六进制规则处理。
 */
const RUN_ID = createTraceId();

/** 归档回调期间产生、需等日志出口安全时补记的告警。 */
const pendingRotationNotices: { level: SimpleLevel; msg: string; data: unknown }[] = [];

/** 标记正在补记归档告警，避免补记自身再次触发补记。 */
let isFlushingRotationNotices = false;

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
    return path.join(logPath, `${LOG_FILE_PREFIX}-${day}.jsonl`);
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
        runId: RUN_ID,
        pid: process.pid,
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

// 终端管道关闭后不再发起新的输出写入。
let isDevelopmentConsoleAvailable = true;

/**
 * 处理开发终端输出流错误。
 * @param error stdout 或 stderr 发出的异步错误。
 * @throws 非终端断开导致的错误，避免掩盖真正的运行时问题。
 */
function handleDevelopmentConsoleStreamError(error: Error): void {
    if (isBrokenConsolePipeError(error)) {
        isDevelopmentConsoleAvailable = false;
        return;
    }

    throw error;
}

/**
 * 将日志写入开发终端。
 *
 * 开发服务器终止时，Electron 主进程可能仍在处理任务取消日志，而 Forge 已关闭
 * stdout/stderr 对应的管道。socket 会以 error 事件报告异步 EIO，因此在初始化时
 * 注册监听器并在管道断开后停止输出；日志文件 transport 不受影响。
 *
 * @param options electron-log 已格式化的控制台日志消息。
 */
function writeToDevelopmentConsole({ message }: { message: { data: unknown[]; level: string } }): void {
    if (!isDevelopmentConsoleAvailable) {
        return;
    }

    const stream = message.level === 'error' || message.level === 'warn' ? process.stderr : process.stdout;

    try {
        stream.write(`${util.format(...message.data)}\n`, () => undefined);
    } catch (error) {
        if (isBrokenConsolePipeError(error)) {
            return;
        }
        throw error;
    }
}

/**
 * 判断终端输出管道是否已被开发服务器关闭。
 * @param error 写入 stdout 或 stderr 时抛出的错误。
 * @returns 管道关闭导致的 EIO、EPIPE 或已销毁流错误时返回 true。
 */
function isBrokenConsolePipeError(error: unknown): boolean {
    if (!(error instanceof Error)) {
        return false;
    }

    return error.name === 'Error'
        && ('code' in error)
        && (error.code === 'EIO' || error.code === 'EPIPE' || error.code === 'ERR_STREAM_DESTROYED');
}

/**
 * 把归档期间的结果暂存起来，等日志出口安全时再写入日志文件。
 *
 * 归档回调运行在 file transport 内部，此时外层 transport 还没执行 `file.reset()`，
 * 文件依旧被判定为超限；在这里直接写日志会重新进入 transport 并再次触发归档，形成递归。
 * @param notice 待补记的事件。
 */
function deferRotationNotice(notice: { level: SimpleLevel; msg: string; data: unknown }): void {
    pendingRotationNotices.push(notice);
}

/**
 * 自定义日志归档：把超限文件重命名为带序号的归档文件，避免默认策略互相覆盖。
 *
 * 行为说明：
 * - 归档名形如 `main-YYYY-MM-DD.<seq>.jsonl`，seq 从 1 递增到第一个不存在的编号，因此进程重启后仍会续号；
 * - 归档结果不在此处写日志，统一经 `deferRotationNotice` 延后补记，防止 transport 重入；
 * - rename 失败时先入队 error 再重新抛出，让这一行被丢弃而不是继续往超限文件追加。
 * @param oldLogFile 达到大小上限的日志文件。
 */
function archiveLogFile(oldLogFile: { path: string; size: number }): void {
    const oldPath = oldLogFile.path;
    const dir = path.dirname(oldPath);
    const parsed = path.parse(oldPath);

    let seq = 1;
    let archivedPath = path.join(dir, `${parsed.name}.${seq}${parsed.ext}`);
    while (fs.existsSync(archivedPath)) {
        seq += 1;
        archivedPath = path.join(dir, `${parsed.name}.${seq}${parsed.ext}`);
    }

    const bytes = oldLogFile.size;
    try {
        fs.renameSync(oldPath, archivedPath);
    } catch (error) {
        deferRotationNotice({ level: 'error', msg: 'log archive failed', data: { error, oldPath, archivedPath } });
        throw error;
    }

    deferRotationNotice({ level: 'info', msg: 'log archived', data: { archivedPath, bytes } });
}

log.initialize({ preload: true });
log.transports.file.resolvePathFn = todayFile;
log.transports.file.level = 'silly';
log.transports.file.maxSize = LOG_FILE_MAX_BYTES;
log.transports.file.archiveLogFn = archiveLogFile;
log.transports.file.format = ({ data, level, message }) => [
    formatTransportLine(data, level, message.date),
];
log.transports.console.level = isDevelopmentMode() ? 'silly' : 'warn';
log.transports.console.format = formatConsoleLine;
log.transports.console.writeFn = writeToDevelopmentConsole;
if (isDevelopmentMode()) {
    process.stdout.on('error', handleDevelopmentConsoleStreamError);
    process.stderr.on('error', handleDevelopmentConsoleStreamError);
}
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
        runId: RUN_ID,
        pid: process.pid,
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
 * 将归档期间暂存的事件补记到日志文件。
 *
 * 只能由日志出口在安全时机调用；补记自身若再次触发归档，靠 `isFlushingRotationNotices`
 * 守卫避免递归，剩余告警留到下一次写入继续补记。
 */
function flushRotationNotices(): void {
    if (isFlushingRotationNotices || pendingRotationNotices.length === 0) {
        return;
    }

    isFlushingRotationNotices = true;
    try {
        const notices = pendingRotationNotices.splice(0);
        notices.forEach((notice) => {
            const line = JSON.stringify(createRecord({
                ts: new Date().toISOString(),
                level: notice.level,
                process: 'main',
                module: 'logger-rotate',
                msg: notice.msg,
                data: notice.data,
            }));
            log[notice.level](line);
        });
    } finally {
        isFlushingRotationNotices = false;
    }
}

/**
 * 将日志事件写入对应 transport。
 * @param event 原始日志事件；调用方需提供明确的进程、模块和级别。
 */
export function writeEvent(event: SimpleEvent): void {
    if (!shouldLog(event.level)) {
        return;
    }

    const line = JSON.stringify(createRecord(event));
    try {
        log[event.level](line);
    } finally {
        flushRotationNotices();
    }
}

/**
 * 在 main 进程创建并写入日志事件。
 * @param moduleName 日志模块名。
 * @param level 日志级别。
 * @param msg 事件描述。
 * @param data 可选结构化上下文。
 */
function logAt(moduleName: string, level: SimpleLevel, msg: string, data?: unknown): void {
    writeEvent({
        ts: new Date().toISOString(),
        level,
        process: 'main',
        module: moduleName,
        msg,
        data,
        traceId: getCurrentTraceId(),
    });
}

/**
 * 创建指定模块的 main 进程日志器。
 * @param moduleName 稳定模块名。
 * @returns 可复用日志器；trace ID 由当前异步上下文自动附带。
 */
function createLogger(moduleName: string): MainLogger {
    return {
        debug: (msg, data) => logAt(moduleName, 'debug', msg, data),
        info: (msg, data) => logAt(moduleName, 'info', msg, data),
        warn: (msg, data) => logAt(moduleName, 'warn', msg, data),
        error: (msg, data) => logAt(moduleName, 'error', msg, data),
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

/** 受管日志文件的磁盘条目快照。 */
interface LogFileEntry {
    /** 绝对路径。 */
    fullPath: string;
    /** 文件字节数。 */
    size: number;
    /** 最后修改时间（毫秒）。 */
    mtimeMs: number;
}

/**
 * 列出目录下所有受管日志文件。
 * @returns 按文件名正则筛选后的文件条目。
 */
function listManagedLogFiles(): LogFileEntry[] {
    return fs.readdirSync(logPath)
        .filter((file) => LOG_FILE_PATTERN.test(file))
        .map((file) => {
            const fullPath = path.join(logPath, file);
            const fileStat = fs.statSync(fullPath);
            return { fullPath, size: fileStat.size, mtimeMs: fileStat.mtimeMs };
        });
}

/**
 * 删除超过保留期或超出目录容量预算的日志文件。
 *
 * 行为说明：
 * - 超过 `days` 的文件先删，当天正在写入的主文件即使过期也保留，避免与 transport 争抢同一文件；
 * - 剩余文件总大小仍超过 `budgetBytes` 时，按修改时间升序删除最旧的归档直到回到预算内；
 * - 当天主文件不参与预算裁剪，因此预算是"归档总量 + 主文件"的软上限。
 * @param days 保留天数。
 * @param budgetBytes 日志目录总容量预算（字节）。
 */
export function pruneOldLogs(days = LOG_RETENTION_DAYS, budgetBytes = LOG_DIR_BUDGET_BYTES): void {
    const keepMs = days * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const liveFile = todayFile();

    try {
        let totalBytes = 0;
        const retained: LogFileEntry[] = [];

        listManagedLogFiles().forEach((entry) => {
            const expired = now - entry.mtimeMs > keepMs;
            if (expired && entry.fullPath !== liveFile) {
                fs.unlinkSync(entry.fullPath);
                return;
            }
            totalBytes += entry.size;
            retained.push(entry);
        });

        if (totalBytes <= budgetBytes) {
            return;
        }

        const archivable = retained
            .filter((entry) => entry.fullPath !== liveFile)
            .sort((a, b) => a.mtimeMs - b.mtimeMs);

        for (const entry of archivable) {
            if (totalBytes <= budgetBytes) {
                break;
            }
            fs.unlinkSync(entry.fullPath);
            totalBytes -= entry.size;
        }
    } catch (error) {
        getMainLogger('logger-prune').error('prune old logs failed', { error });
    }
}

// 短时会话可能活不到下一个 24 小时周期，因此启动后先跑一次预算与保留期清理。
setTimeout(() => pruneOldLogs(), 60 * 1000).unref();
setInterval(() => pruneOldLogs(), 24 * 60 * 60 * 1000).unref();
