import { getRendererLogger } from '@/fronted/log/simple-logger';
import { storeEvents } from './storeEvents';
import { i18n } from '@/fronted/i18n/i18n';

type ToastVariant = 'default' | 'success' | 'info' | 'warning' | 'error';

function emitToast(detail: {
    title?: string;
    message: string;
    variant?: ToastVariant;
    dedupeKey?: string;
    bubble?: boolean;
}) {
    window.dispatchEvent(new CustomEvent('show-toast', { detail }));
}

function normalizeErrorMessage(error: unknown): string {
    if (!error) return i18n.t('common.unknownError');
    if (error instanceof Error) return error.message || i18n.t('common.unknownError');
    if (typeof error === 'string') return error;
    try {
        return JSON.stringify(error);
    } catch {
        return String(error);
    }
}

let cleanupFn: (() => void) | null = null;

export function initIpcMessageToasts(): () => void {
    const logger = getRendererLogger('IpcMessageToasts');

    if (cleanupFn) {
        logger.warn('ipc message toasts already initialized');
        return cleanupFn;
    }

    const unsubs: Array<() => void> = [];

    if (storeEvents.onErrorMsg) {
        unsubs.push(storeEvents.onErrorMsg((error) => {
            const message = normalizeErrorMessage(error);
            emitToast({
                title: i18n.t('common.errorTitle'),
                message,
                variant: 'error',
                dedupeKey: `ipc-error:${message}`,
            });
        }));
    }

    if (storeEvents.onInfoMsg) {
        unsubs.push(storeEvents.onInfoMsg((info) => {
            emitToast({
                title: i18n.t('common.infoTitle'),
                message: info,
                variant: 'info',
                dedupeKey: `ipc-info:${info}`,
            });
        }));
    }

    cleanupFn = () => {
        unsubs.forEach((u) => u());
        cleanupFn = null;
        logger.info('ipc message toasts stopped');
    };

    logger.info('ipc message toasts started');
    return cleanupFn;
}
