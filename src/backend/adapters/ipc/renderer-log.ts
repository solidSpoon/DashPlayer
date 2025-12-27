// src/backend/ipc/renderer-log.ts
import { ipcMain } from 'electron';
import { SimpleEvent } from '@/common/log/simple-types';
import { writeEvent } from '@/backend/ioc/simple-logger';

ipcMain.on('dp-log/write', (_event, e: SimpleEvent) => {
    writeEvent({
        ts: e.ts || new Date().toISOString(),
        level: e.level,
        process: 'renderer',
        module: e.module || 'unknown',
        msg: e.msg || '',
        data: e.data,
    });
});
