/**
 * 后端后台任务被用户取消的错误类型名（`CancelByUserError` 实例的 `name`）。
 *
 * 定义在 common 是因为判定发生在两侧：main 抛出后经 IPC 结构化克隆仍保留 `name`，
 * renderer 侧同样要靠它区分"用户取消"与真实故障。集中一份字面量，避免抛出端与判定端各写一遍后跑偏。
 */
export const CANCEL_BY_USER_ERROR_NAME = 'CancelByUserError';

/**
 * 判断异常是否由用户主动取消产生。
 *
 * 取消属于预期行为，main 与 renderer 两侧都不应按 error 记录，否则排障时间线会被
 * 大量无害的 AbortError 淹没。判定仅依据错误类型名：浏览器/axios 原生的
 * `AbortError`/`CanceledError`，以及本项目显式标记的 {@link CANCEL_BY_USER_ERROR_NAME}。
 * 不再用 message 正则——它会把恰好含 "cancel"/"killed" 字样的真实故障误判为预期取消并降级。
 * @param error 捕获到的未知异常。
 * @returns 属于用户主动取消时返回 true。
 */
export function isUserCancellation(error: unknown): boolean {
    if (!(error instanceof Error)) {
        return false;
    }
    return error.name === 'AbortError'
        || error.name === 'CanceledError'
        || error.name === CANCEL_BY_USER_ERROR_NAME;
}
