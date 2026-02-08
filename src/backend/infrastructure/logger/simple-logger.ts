import fs from 'fs';
import path from 'path';
import util from 'util';
import log from 'electron-log/main';
import { SimpleEvent, SimpleLevel } from '@/common/log/simple-types';
import LocationUtil from '@/backend/utils/LocationUtil';
import { LocationType } from '@/backend/application/services/LocationService';
import { isDevelopmentMode } from '@/backend/utils/runtimeEnv';

const logPath = LocationUtil.staticGetStoragePath(LocationType.LOGS);

if (!fs.existsSync(logPath)) {
    fs.mkdirSync(logPath, { recursive: true });
}

function todayFile() {
    const d = new Date();
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return path.join(logPath, `main-${day}.log`);
}

log.initialize({ preload: true });
log.transports.file.resolvePathFn = todayFile;
log.transports.file.level = 'silly';
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
log.transports.console.level = isDevelopmentMode() ? 'silly' : 'warn';
log.errorHandler.startCatching();

const levelOrder: Record<SimpleLevel, number> = {
    debug: 20,
    info: 30,
    warn: 40,
    error: 50,
};

const FOCUS_PREFIX_PATTERN = /^\[FOCUS:([^\]]+)\]\s*/;

function normalizeLevel(level: string | undefined): SimpleLevel | null {
    if (level === 'debug' || level === 'info' || level === 'warn' || level === 'error') {
        return level;
    }
    return null;
}

function defaultLevel(): SimpleLevel {
    const envLevel = normalizeLevel(process.env.DP_LOG_LEVEL);
    if (envLevel) {
        return envLevel;
    }
    return isDevelopmentMode() ? 'debug' : 'info';
}

let CURRENT_LEVEL: SimpleLevel = defaultLevel();

export function setLogLevel(level: SimpleLevel) {
    CURRENT_LEVEL = level;
}

function shouldLog(level: SimpleLevel) {
    return levelOrder[level] >= levelOrder[CURRENT_LEVEL];
}

function normalizeCsvInput(input?: string): string[] {
    if (!input) return [];
    return input.split(',').map(item => item.trim()).filter(Boolean);
}

function createModuleFilterSet(input?: string): Set<string> | null {
    const modules = normalizeCsvInput(input);
    if (modules.length === 0) {
        return null;
    }
    return new Set(modules);
}

function normalizeFocusToken(input?: string): string | null {
    const token = input?.trim();
    return token ? token : null;
}

const INCLUDE_MODULE_FILTER: Set<string> | null = createModuleFilterSet(process.env.DP_LOG_INCLUDE_MODULES);
const EXCLUDE_MODULE_FILTER: Set<string> | null = createModuleFilterSet(process.env.DP_LOG_EXCLUDE_MODULES);
const FOCUS_TOKEN_FILTER: string | null = normalizeFocusToken(process.env.DP_LOG_FOCUS_TOKEN);

function shouldLogModule(moduleName: string): boolean {
    if (INCLUDE_MODULE_FILTER && !INCLUDE_MODULE_FILTER.has(moduleName)) {
        return false;
    }
    if (EXCLUDE_MODULE_FILTER && EXCLUDE_MODULE_FILTER.has(moduleName)) {
        return false;
    }
    return true;
}

function extractFocusToken(msg: string): string | undefined {
    const matched = msg.match(FOCUS_PREFIX_PATTERN);
    return matched?.[1]?.trim() || undefined;
}

function shouldLogFocus(msg: string, focus?: string): boolean {
    if (!FOCUS_TOKEN_FILTER) {
        return true;
    }
    return (focus || extractFocusToken(msg)) === FOCUS_TOKEN_FILTER;
}

function normalizeData(data: unknown): string {
    if (data === undefined) return '';
    if (data instanceof Error) {
        const stack = data.stack ? data.stack.split('\n').slice(0, 5).join(' | ') : '';
        return stack ? `${data.name}: ${data.message} | ${stack}` : `${data.name}: ${data.message}`;
    }
    try {
        return util.inspect(data, { depth: 3, breakLength: Infinity, compact: true });
    } catch {
        return String(data);
    }
}

function toSingleLine(text: string) {
    return text.replaceAll('\n', ' | ').replaceAll('\r', '');
}

function truncate(text: string, maxLen = 1200) {
    if (text.length <= maxLen) return text;
    return `${text.slice(0, maxLen)}…`;
}

function formatLine(event: SimpleEvent) {
    const focusLabel = event.focus ? `|focus:${event.focus}` : '';
    const prefix = `[${event.process}|${event.module}${focusLabel}]`;
    const msg = event.msg ? toSingleLine(event.msg.replace(FOCUS_PREFIX_PATTERN, '')) : '';
    const isPrimitiveData = event.data === null || ['string', 'number', 'boolean'].includes(typeof event.data);
    const includeData = event.level === 'warn' || event.level === 'error' || isPrimitiveData;
    const data = includeData ? normalizeData(event.data) : '';
    const dataPart = data ? ` ${truncate(toSingleLine(data), 800)}` : '';
    return `${prefix} ${msg}${dataPart}`.trim();
}

export function writeEvent(event: SimpleEvent) {
    if (!shouldLog(event.level)) {
        return;
    }
    if (!shouldLogModule(event.module)) {
        return;
    }
    if (!shouldLogFocus(event.msg, event.focus)) {
        return;
    }
    const line = formatLine({
        ...event,
        ts: event.ts || new Date().toISOString(),
        focus: event.focus || extractFocusToken(event.msg),
    });

    switch (event.level) {
        case 'debug':
            log.debug(line);
            break;
        case 'info':
            log.info(line);
            break;
        case 'warn':
            log.warn(line);
            break;
        case 'error':
            log.error(line);
            break;
    }
}

function logAt(moduleName: string, level: SimpleLevel, msg: string, data?: any) {
    writeEvent({
        ts: new Date().toISOString(),
        level,
        process: 'main',
        module: moduleName,
        msg,
        data,
    });
}

type MainLogger = {
    debug: (msg: string, data?: any) => void;
    info: (msg: string, data?: any) => void;
    warn: (msg: string, data?: any) => void;
    error: (msg: string, data?: any) => void;
    withFocus: (focusToken: string) => MainLogger;
};

function prependFocusToken(msg: string, focusToken?: string) {
    if (!focusToken) return msg;
    if (FOCUS_PREFIX_PATTERN.test(msg)) return msg;
    return `[FOCUS:${focusToken}] ${msg}`;
}

function createLogger(moduleName: string, focusToken?: string): MainLogger {
    return {
        debug: (msg, data) => logAt(moduleName, 'debug', prependFocusToken(msg, focusToken), data),
        info: (msg, data) => logAt(moduleName, 'info', prependFocusToken(msg, focusToken), data),
        warn: (msg, data) => logAt(moduleName, 'warn', prependFocusToken(msg, focusToken), data),
        error: (msg, data) => logAt(moduleName, 'error', prependFocusToken(msg, focusToken), data),
        withFocus: (nextFocusToken) => createLogger(moduleName, nextFocusToken),
    };
}

export function getMainLogger(moduleName: string): MainLogger {
    return createLogger(moduleName);
}

export function pruneOldLogs(days = 14) {
    const keepMs = days * 24 * 60 * 60 * 1000;
    const now = Date.now();

    try {
        const files = fs.readdirSync(logPath);
        files.forEach((file) => {
            if (!/^main-\\d{4}-\\d{2}-\\d{2}\\.log$/.test(file)) return;
            const full = path.join(logPath, file);
            const st = fs.statSync(full);
            if (now - st.mtimeMs > keepMs) fs.unlinkSync(full);
        });
    } catch (error) {
        getMainLogger('logger-prune').error('pruneOldLogs error', { error });
    }
}

setInterval(() => pruneOldLogs(), 24 * 60 * 60 * 1000).unref();
