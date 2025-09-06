// src/backend/ipc/renderer-log.ts
import { ipcMain } from 'electron';
import { getMainLogger } from '@/backend/ioc/simple-logger';
import { SimpleEvent } from '@/common/log/simple-types';

const log = getMainLogger('RendererLog');

ipcMain.on('dp-log/write', (_event, e: SimpleEvent) => {
  // 为了简单，这里按级别转发到 main 统一文件
  switch (e.level) {
    case 'debug': log.debug(`[${e.module}] ${e.msg}`, e.data); break;
    case 'info':  log.info(`[${e.module}] ${e.msg}`, e.data); break;
    case 'warn':  log.warn(`[${e.module}] ${e.msg}`, e.data); break;
    case 'error': log.error(`[${e.module}] ${e.msg}`, e.data); break;
  }
});