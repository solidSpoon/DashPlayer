import type { SimpleLevel } from '@/common/log/simple-types';
import { getMainLogger } from './simple-logger';

type DpLog = {
    debug: (...args: any[]) => void;
    info: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
    log: (...args: any[]) => void;
    withTags: (tags: string | string[]) => DpLog;
};

const base = getMainLogger('dpLog');

function logWithLevel(
    logger: ReturnType<typeof getMainLogger>,
    level: SimpleLevel | 'log',
    ...args: any[]
) {
    const [first, ...rest] = args;
    const msg = typeof first === 'string' ? first : String(first);
    const data = rest.length > 0 ? { args: rest } : undefined;

    switch (level) {
        case 'debug':
            logger.debug(msg, data);
            break;
        case 'info':
        case 'log':
            logger.info(msg, data);
            break;
        case 'warn':
            logger.warn(msg, data);
            break;
        case 'error':
            logger.error(msg, data);
            break;
    }
}

const createDpLog = (logger: ReturnType<typeof getMainLogger>): DpLog => ({
    debug: (...args) => logWithLevel(logger, 'debug', ...args),
    info: (...args) => logWithLevel(logger, 'info', ...args),
    warn: (...args) => logWithLevel(logger, 'warn', ...args),
    error: (...args) => logWithLevel(logger, 'error', ...args),
    log: (...args) => logWithLevel(logger, 'log', ...args),
    withTags: (tags) => createDpLog(logger.withTags(tags)),
});

const dpLog: DpLog = createDpLog(base);

export default dpLog;
