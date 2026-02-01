// src/fronted/log/simple-logger.ts
import type { SimpleLevel } from '@/common/log/simple-types';
import { logWriter } from '@/fronted/application/bootstrap/logWriter';

type RendererLogger = {
  debug: (msg: string, data?: any) => void;
  info: (msg: string, data?: any) => void;
  warn: (msg: string, data?: any) => void;
  error: (msg: string, data?: any) => void;
};

const levelOrder: Record<SimpleLevel, number> = {
  debug: 20, info: 30, warn: 40, error: 50,
};

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

const CURRENT_LEVEL: SimpleLevel = getDefaultLevel();

const RENDERER_LOGGER_CACHE = new Map<string, RendererLogger>();

function write(processName: 'renderer', moduleName: string, level: SimpleLevel, msg: string, data?: any) {
  // 控制台输出（便于开发定位）
  const prefix = `[${processName}|${moduleName}|${level}]`;
  const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : level === 'debug' ? 'debug' : 'log';
  // eslint-disable-next-line no-console
  console[method](prefix, msg, data ?? '');

  // 发给主进程落盘
  try {
    logWriter.write({
      ts: new Date().toISOString(),
      level,
      process: processName,
      module: moduleName,
      msg,
      data,
    });
  } catch {
    // ignore
  }
}

export function getRendererLogger(moduleName: string): RendererLogger {
  const cached = RENDERER_LOGGER_CACHE.get(moduleName);
  if (cached) return cached;

  const at = (level: SimpleLevel, msg: string, data?: any) => {
    if (levelOrder[level] < levelOrder[CURRENT_LEVEL]) return;
    write('renderer', moduleName, level, msg, data);
  };
  const logger: RendererLogger = {
    debug: (msg: string, data?: any) => at('debug', msg, data),
    info:  (msg: string, data?: any) => at('info',  msg, data),
    warn:  (msg: string, data?: any) => at('warn',  msg, data),
    error: (msg: string, data?: any) => at('error', msg, data),
  };

  RENDERER_LOGGER_CACHE.set(moduleName, logger);
  return logger;
}
