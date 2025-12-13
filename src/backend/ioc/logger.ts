import type { SimpleLevel } from '@/common/log/simple-types';
import { getMainLogger } from '@/backend/ioc/simple-logger';

type DpLog = {
    debug: (...args: any[]) => void;
    info: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
    log: (...args: any[]) => void;
};

const base = getMainLogger('dpLog');

function logWithLevel(level: SimpleLevel | 'log', ...args: any[]) {
    const [first, ...rest] = args;
    const msg = typeof first === 'string' ? first : String(first);
    const data = rest.length > 0 ? { args: rest } : undefined;

    switch (level) {
        case 'debug':
            base.debug(msg, data);
            break;
        case 'info':
        case 'log':
            base.info(msg, data);
            break;
        case 'warn':
            base.warn(msg, data);
            break;
        case 'error':
            base.error(msg, data);
            break;
    }
}

const dpLog: DpLog = {
    debug: (...args) => logWithLevel('debug', ...args),
    info: (...args) => logWithLevel('info', ...args),
    warn: (...args) => logWithLevel('warn', ...args),
    error: (...args) => logWithLevel('error', ...args),
    log: (...args) => logWithLevel('log', ...args),
};

export default dpLog;
