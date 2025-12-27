import type { SimpleEvent } from '@/common/log/simple-types';

export interface LogWriterPort {
    write(event: SimpleEvent): void;
}

