/**
 * 解除定时器对进程退出的阻塞。
 *
 * Node 的 `setTimeout` 返回带 `unref` 的 Timeout，浏览器返回 number；
 * main 与 renderer 共用的代码需要两种运行时下都能安全调用。
 * @param timer 定时器句柄。
 */
export function detachTimer(timer: ReturnType<typeof setTimeout>): void {
    const maybeUnref = (timer as { unref?: () => void }).unref;
    if (typeof maybeUnref === 'function') {
        maybeUnref.call(timer);
    }
}
