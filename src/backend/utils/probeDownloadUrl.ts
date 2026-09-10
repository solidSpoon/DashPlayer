import axios from 'axios';

/** 单个候选地址的可达性探测超时（毫秒）。探测只等待响应头，不传输模型本体，5 秒足够。 */
const PROBE_TIMEOUT_MS = 5000;

/**
 * 探测候选下载地址的可达性，返回按声明顺序第一个可达的地址。
 *
 * 对每个候选地址并行发 HEAD 请求（axios 默认跟随重定向，HuggingFace 会 302 到
 * CDN，hf-mirror 会 308），收到 2xx 响应头即视为可达。并行探测的总耗时封顶为
 * 单个探测超时；全部不可达时返回 `null`，由调用方决定回退策略。
 *
 * 为什么不用地理/IP 判断选源：挂代理的国内用户直连官方反而更快，网络可达性
 * 探测天然覆盖这类网络环境差异。
 *
 * @param urls 有序候选地址（声明顺序即优先级，官方在前、镜像在后）。
 * @param signal 取消信号；取消后所有探测请求中止，视为全部不可达。
 * @param timeoutMs 单地址探测超时（毫秒），测试可注入更短超时。
 * @returns 第一个可达的地址；全部不可达时返回 `null`。
 */
export async function probeReachableDownloadUrl(
    urls: readonly string[],
    signal: AbortSignal,
    timeoutMs: number = PROBE_TIMEOUT_MS,
): Promise<string | null> {
    // Promise.allSettled：单个地址超时/网络错误只代表该地址不可达，不应让其他探测失败。
    const probes = await Promise.allSettled(urls.map(async (url) => {
        await axios.head(url, { timeout: timeoutMs, signal });
        return url;
    }));
    for (const probe of probes) {
        // 非 2xx 会被 axios 默认 validateStatus 判为 rejected，这里只认显式成功。
        if (probe.status === 'fulfilled') {
            return probe.value;
        }
    }
    return null;
}
