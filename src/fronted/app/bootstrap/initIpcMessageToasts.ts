import { getRendererLogger } from '@/fronted/log/simple-logger';
import { rendererEvents } from '@/fronted/infrastructure/electron/rendererEvents';

/** renderer 全局提示事件的展示参数。 */
type ToastVariant = 'default' | 'success' | 'info' | 'warning' | 'error';

/** renderer 全局提示事件的参数。 */
interface ToastDetail {
    /** 提示标题。 */
    title?: string;
    /** 提示正文。 */
    message: string;
    /** 提示样式。 */
    variant?: ToastVariant;
    /** 用于合并重复提示的稳定键。 */
    dedupeKey?: string;
    /** 是否允许提示继续冒泡。 */
    bubble?: boolean;
}

/**
 * 向 React 提示组件派发全局事件。
 *
 * @param detail 提示内容和展示选项。
 */
function emitToast(detail: ToastDetail): void {
    window.dispatchEvent(new CustomEvent('show-toast', { detail }));
}

/**
 * 将未知错误转换为可展示文本。
 *
 * @param error 捕获到的未知错误。
 * @returns 可展示的错误信息。
 */
function normalizeErrorMessage(error: unknown): string {
    if (!error) return 'Unknown error';
    if (error instanceof Error) return error.message || 'Error';
    if (typeof error === 'string') return error;
    try {
        return JSON.stringify(error);
    } catch {
        return String(error);
    }
}

let cleanupFn: (() => void) | null = null;

/**
 * 初始化 main 进程消息对应的全局提示监听。
 *
 * @returns 清理全部消息监听并重置初始化状态的函数。
 */
export function initIpcMessageToasts(): () => void {
    const logger = getRendererLogger('IpcMessageToasts');

    if (cleanupFn) {
        logger.warn('ipc message toasts already initialized');
        return cleanupFn;
    }

    const unsubs: Array<() => void> = [];

    unsubs.push(rendererEvents.onErrorMessage((error) => {
        const message = normalizeErrorMessage(error);
        emitToast({
            title: 'Error',
            message,
            variant: 'error',
            dedupeKey: `ipc-error:${message}`,
        });
    }));

    unsubs.push(rendererEvents.onInfoMessage((info) => {
        emitToast({
            title: 'Info',
            message: info,
            variant: 'info',
            dedupeKey: `ipc-info:${info}`,
        });
    }));

    cleanupFn = () => {
        unsubs.forEach((u) => u());
        cleanupFn = null;
        logger.info('ipc message toasts stopped');
    };

    logger.info('ipc message toasts started');
    return cleanupFn;
}
