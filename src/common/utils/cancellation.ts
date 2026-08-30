/**
 * 判断异常是否由用户主动取消产生。
 *
 * 取消属于预期行为，main 与 renderer 两侧都不应按错误记录，否则排障时间线会被
 * 大量无害的 AbortError 淹没。两侧共用本判定，避免规则在两地各写一遍后逐渐跑偏。
 * @param error 捕获到的未知异常。
 * @returns 属于用户主动取消时返回 true。
 */
export function isUserCancellation(error: unknown): boolean {
    if (!(error instanceof Error)) {
        return false;
    }
    return error.name === 'CanceledError'
        || error.name === 'AbortError'
        || /cancel|取消/i.test(error.message);
}
