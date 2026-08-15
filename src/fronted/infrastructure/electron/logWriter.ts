import type { SimpleEvent } from '@/common/log/simple-types';

/**
 * 将 renderer 日志发送给 main 进程。
 *
 * @param event 结构化日志事件。
 */
export function writeRendererLog(event: SimpleEvent): void {
    window.electron.dpLogger.write(event);
}
