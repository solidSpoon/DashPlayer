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

type LogTagsInput = string | string[] | undefined | null;

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

function normalizeTagsInput(tags: LogTagsInput): string[] {
    if (!tags) return [];
    if (Array.isArray(tags)) {
        return tags.map(tag => tag.trim()).filter(Boolean);
    }
    return tags.split(',').map(tag => tag.trim()).filter(Boolean);
}

function isTagsFilterDisabled(tags: string[]): boolean {
    return tags.some(tag => tag === '*' || tag.toLowerCase() === 'all');
}

let TAG_FILTER: Set<string> | null = (() => {
    const envTags = normalizeTagsInput(process.env.DP_LOG_TAGS);
    if (envTags.length === 0) {
        return null;
    }
    if (isTagsFilterDisabled(envTags)) {
        return null;
    }
    return new Set(envTags);
})();

export function setLogTags(tags?: string[]) {
    if (!tags || tags.length === 0) {
        TAG_FILTER = null;
        return;
    }
    TAG_FILTER = isTagsFilterDisabled(tags) ? null : new Set(tags);
}

function normalizeEventTags(tags?: LogTagsInput): string[] | undefined {
    const normalized = normalizeTagsInput(tags);
    return normalized.length > 0 ? normalized : undefined;
}

function shouldLogTags(tags?: string[]): boolean {
    if (!TAG_FILTER) {
        return true;
    }
    if (!tags || tags.length === 0) {
        return false;
    }
    return tags.some(tag => TAG_FILTER?.has(tag));
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
    const tagLabel = event.tags && event.tags.length > 0 ? `|${event.tags.join(',')}` : '';
    const prefix = `[${event.process}|${event.module}${tagLabel}]`;
    const msg = event.msg ? toSingleLine(event.msg) : '';
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
    if (!shouldLogTags(event.tags)) {
        return;
    }
    const line = formatLine({
        ...event,
        ts: event.ts || new Date().toISOString(),
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

function logAt(moduleName: string, level: SimpleLevel, msg: string, data?: any, tags?: LogTagsInput) {
    writeEvent({
        ts: new Date().toISOString(),
        level,
        process: 'main',
        module: moduleName,
        msg,
        data,
        tags: normalizeEventTags(tags),
    });
}

function mergeTags(base?: string[], extra?: LogTagsInput): string[] | undefined {
    const normalizedExtra = normalizeEventTags(extra);
    if (!base || base.length === 0) {
        return normalizedExtra;
    }
    if (!normalizedExtra || normalizedExtra.length === 0) {
        return base;
    }
    return Array.from(new Set([...base, ...normalizedExtra]));
}

type MainLogger = {
    debug: (msg: string, data?: any, tags?: LogTagsInput) => void;
    info: (msg: string, data?: any, tags?: LogTagsInput) => void;
    warn: (msg: string, data?: any, tags?: LogTagsInput) => void;
    error: (msg: string, data?: any, tags?: LogTagsInput) => void;
    withTags: (tags: LogTagsInput) => MainLogger;
};

function createLogger(moduleName: string, baseTags?: string[]): MainLogger {
    return {
        debug: (msg, data, tags) => logAt(moduleName, 'debug', msg, data, mergeTags(baseTags, tags)),
        info: (msg, data, tags) => logAt(moduleName, 'info', msg, data, mergeTags(baseTags, tags)),
        warn: (msg, data, tags) => logAt(moduleName, 'warn', msg, data, mergeTags(baseTags, tags)),
        error: (msg, data, tags) => logAt(moduleName, 'error', msg, data, mergeTags(baseTags, tags)),
        withTags: (tags) => createLogger(moduleName, mergeTags(baseTags, tags)),
    };
}

export function getMainLogger(moduleName: string, tags?: LogTagsInput): MainLogger {
    return createLogger(moduleName, normalizeEventTags(tags));
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
