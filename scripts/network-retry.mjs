/**
 * 网络抖动重试：发版链路上的资产下载（ffmpeg / whisper.cpp 运行时 / GitHub API 查询）
 * 依赖不少第三方站点，一次 DNS 抖动或 5xx 就会让整个发版失败，
 * 而这类错误重试一次基本就能过。
 */

/** 值得重试的错误码：DNS 解析失败、连接被重置/超时、连接被拒等瞬时网络故障。 */
const RETRYABLE_ERROR_CODES = new Set([
    'ENOTFOUND',
    'EAI_AGAIN',
    'ECONNRESET',
    'ECONNREFUSED',
    'ECONNABORTED',
    'ETIMEDOUT',
    'EPIPE',
    'ERR_NETWORK',
    // 流式下载被截断：内容长度与 sha1 对不上，重下一次通常就好了
    'HASH_MISMATCH',
]);

/**
 * 判断一个错误是否值得重试。
 *
 * @param {unknown} error 抛出的错误对象（axios 错误带 code / response）。
 * @returns {boolean} 瞬时故障返回 true；404 这类确定性失败返回 false（重试也没用）。
 */
export const isRetryableNetworkError = (error) => {
    const code = error && typeof error === 'object' ? error.code : undefined;
    if (typeof code === 'string' && RETRYABLE_ERROR_CODES.has(code)) {
        return true;
    }
    const status = error && typeof error === 'object' ? error.response?.status : undefined;
    return typeof status === 'number' && (status === 429 || status >= 500);
};

/**
 * 执行网络任务，遇到瞬时故障按指数退避重试。
 *
 * @param {() => Promise<T>} task 实际发起网络请求的任务；每次重试都会重新调用。
 * @param {{ label?: string, attempts?: number, baseDelayMs?: number, onRetry?: (error: unknown) => void }} [options]
 *   label 日志前缀；attempts 总尝试次数（含首次）；baseDelayMs 首次退避时长，之后翻倍。
 * @returns {Promise<T>} 任务结果。
 * @throws 超出重试次数或遇到不可重试错误时，抛出最后一次的错误。
 * @template T
 */
export const withNetworkRetry = async (task, {label = '网络请求', attempts = 3, baseDelayMs = 2000, onRetry} = {}) => {
    for (let attempt = 1; ; attempt += 1) {
        try {
            return await task();
        } catch (error) {
            if (attempt >= attempts || !isRetryableNetworkError(error)) {
                throw error;
            }
            const delayMs = baseDelayMs * 2 ** (attempt - 1);
            onRetry?.(error);
            console.warn(
                `=> ${label} 失败（${error?.code || error?.message || error}），${delayMs / 1000}s 后重试（第 ${attempt + 1}/${attempts} 次）`
            );
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }
};
