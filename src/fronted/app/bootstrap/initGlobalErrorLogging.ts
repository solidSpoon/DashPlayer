import { getRendererLogger } from '@/fronted/log/simple-logger';
import {
    buildErrorSignature,
    clearSuppressedErrorWindows,
    describeForSignature,
    reportSuppressedError,
} from '@/fronted/log/suppressedError';
import { isUserCancellation } from '@/common/utils/cancellation';

let cleanupFn: (() => void) | null = null;

/**
 * 处理 `error` 事件。
 *
 * 监听必须走捕获阶段，否则 `<video>`、字幕等资源加载失败不会冒泡到 window，
 * 而这类资源错误正是播放故障最直接的证据。
 * @param event 捕获到的错误事件。
 */
function handleWindowError(event: ErrorEvent): void {
    const target = event.target;
    if (target !== window && target instanceof Element) {
        const src = target.getAttribute('src') ?? target.getAttribute('href');
        reportSuppressedError({
            module: 'GlobalError',
            signature: `resource:${target.tagName}:${src ?? 'unknown'}`,
            level: 'warn',
            msg: 'resource load failed',
            data: {
                tagName: target.tagName,
                src,
                pageUrl: window.location.href,
            },
        });
        return;
    }

    const error = event.error;
    reportSuppressedError({
        module: 'GlobalError',
        signature: buildErrorSignature(
            describeForSignature(error) || event.message,
            error instanceof Error ? error.stack : undefined,
        ),
        level: 'error',
        msg: 'uncaught exception',
        data: {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            error,
        },
    });
}

/**
 * 处理未捕获的 Promise 拒绝。
 *
 * 不调用 `preventDefault()`，保留开发工具里的原始堆栈；reason 原样交给日志出口脱敏裁剪。
 * @param event 未处理的拒绝事件。
 */
function handleUnhandledRejection(event: PromiseRejectionEvent): void {
    const reason = event.reason;
    reportSuppressedError({
        module: 'GlobalError',
        signature: buildErrorSignature(
            describeForSignature(reason),
            reason instanceof Error ? reason.stack : undefined,
        ),
        // 用户主动取消属于预期行为，降为 warn，避免淹没真正的故障时间线。
        level: isUserCancellation(reason) ? 'warn' : 'error',
        msg: 'unhandled rejection',
        data: { reason },
    });
}

/**
 * 注册 renderer 全局异常落盘。
 *
 * 这是 renderer 侧唯一的异常兜底入口：electron-log 自带的 renderer 错误处理依赖其
 * session 级 preload 注入，而本项目窗口使用自定义 `preload.js`，因此必须自行监听。
 * @returns 注销监听并清理在途合并窗口的函数。
 */
export function startGlobalErrorLogging(): () => void {
    if (cleanupFn) {
        return cleanupFn;
    }

    const logger = getRendererLogger('GlobalError');
    window.addEventListener('error', handleWindowError, true);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    cleanupFn = () => {
        window.removeEventListener('error', handleWindowError, true);
        window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        clearSuppressedErrorWindows();
        cleanupFn = null;
    };

    logger.info('global error logging started');
    return cleanupFn;
}
