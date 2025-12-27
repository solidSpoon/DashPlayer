import type { SimpleEvent } from '@/common/log/simple-types';
import type { LogWriterPort } from '@/fronted/application/ports/logger/LogWriterPort';

export class ElectronLogWriter implements LogWriterPort {
    write(event: SimpleEvent): void {
        window.electron.dpLogger.write(event);
    }
}

