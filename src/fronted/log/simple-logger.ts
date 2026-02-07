// src/fronted/log/simple-logger.ts
import type { SimpleLevel } from '@/common/log/simple-types';
import { logWriter } from '@/fronted/application/bootstrap/logWriter';

type RendererLogger = {
  debug: (msg: string, data?: any) => void;
  info: (msg: string, data?: any) => void;
  warn: (msg: string, data?: any) => void;
  error: (msg: string, data?: any) => void;
  withFocus: (focusToken: string) => RendererLogger;
};

const levelOrder: Record<SimpleLevel, number> = {
  debug: 20, info: 30, warn: 40, error: 50,
};
const FOCUS_PREFIX_PATTERN = /^\[FOCUS:([^\]]+)\]\s*/;

function normalizeLevel(level?: string): SimpleLevel | null {
  if (level === 'debug' || level === 'info' || level === 'warn' || level === 'error') {
    return level;
  }
  return null;
}

function getDefaultLevel(): SimpleLevel {
  const envLevel = normalizeLevel(import.meta.env.VITE_DP_LOG_LEVEL);
  return envLevel ?? 'info';
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

function extractFocusToken(msg: string): string | undefined {
  const matched = msg.match(FOCUS_PREFIX_PATTERN);
  return matched?.[1]?.trim() || undefined;
}

const CURRENT_LEVEL: SimpleLevel = getDefaultLevel();
const INCLUDE_MODULE_FILTER: Set<string> | null = createModuleFilterSet(import.meta.env.VITE_DP_LOG_INCLUDE_MODULES);
const EXCLUDE_MODULE_FILTER: Set<string> | null = createModuleFilterSet(import.meta.env.VITE_DP_LOG_EXCLUDE_MODULES);
const FOCUS_TOKEN_FILTER: string | null = normalizeFocusToken(import.meta.env.VITE_DP_LOG_FOCUS_TOKEN);

const RENDERER_LOGGER_CACHE = new Map<string, RendererLogger>();

function shouldLogModule(moduleName: string): boolean {
  if (INCLUDE_MODULE_FILTER && !INCLUDE_MODULE_FILTER.has(moduleName)) {
    return false;
  }
  if (EXCLUDE_MODULE_FILTER && EXCLUDE_MODULE_FILTER.has(moduleName)) {
    return false;
  }
  return true;
}

function shouldLogFocus(msg: string, focus?: string): boolean {
  if (!FOCUS_TOKEN_FILTER) {
    return true;
  }
  return (focus || extractFocusToken(msg)) === FOCUS_TOKEN_FILTER;
}

function prependFocusToken(msg: string, focusToken?: string) {
  if (!focusToken) return msg;
  if (FOCUS_PREFIX_PATTERN.test(msg)) return msg;
  return `[FOCUS:${focusToken}] ${msg}`;
}

function write(processName: 'renderer', moduleName: string, level: SimpleLevel, msg: string, data?: any, focus?: string) {
  const focusToken = focus || extractFocusToken(msg);
  const plainMsg = msg.replace(FOCUS_PREFIX_PATTERN, '');
  // 控制台输出（便于开发定位）
  const focusPart = focusToken ? `|focus:${focusToken}` : '';
  const prefix = `[${processName}|${moduleName}|${level}${focusPart}]`;
  const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : level === 'debug' ? 'debug' : 'log';
  // eslint-disable-next-line no-console
  console[method](prefix, plainMsg, data ?? '');

  // 发给主进程落盘
  try {
    logWriter.write({
      ts: new Date().toISOString(),
      level,
      process: processName,
      module: moduleName,
      msg,
      data,
      focus: focusToken,
    });
  } catch {
    // ignore
  }
}

export function getRendererLogger(moduleName: string): RendererLogger {
  const cached = RENDERER_LOGGER_CACHE.get(moduleName);
  if (cached) return cached;

  const createLogger = (focusToken?: string): RendererLogger => {
    const at = (level: SimpleLevel, msg: string, data?: any) => {
      const focusedMsg = prependFocusToken(msg, focusToken);
      if (levelOrder[level] < levelOrder[CURRENT_LEVEL]) return;
      if (!shouldLogModule(moduleName)) return;
      if (!shouldLogFocus(focusedMsg, focusToken)) return;
      write('renderer', moduleName, level, focusedMsg, data, focusToken);
    };
    return {
      debug: (msg: string, data?: any) => at('debug', msg, data),
      info:  (msg: string, data?: any) => at('info',  msg, data),
      warn:  (msg: string, data?: any) => at('warn',  msg, data),
      error: (msg: string, data?: any) => at('error', msg, data),
      withFocus: (nextFocusToken: string) => createLogger(nextFocusToken),
    };
  };
  const logger: RendererLogger = createLogger();

  RENDERER_LOGGER_CACHE.set(moduleName, logger);
  return logger;
}
