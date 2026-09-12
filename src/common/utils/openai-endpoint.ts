import { joinUrl } from '@/common/utils/Util';

/** 云端 API 兼容格式：OpenAI chat completions、Anthropic messages、Gemini generateContent。 */
export type AiApiFormat = 'openai' | 'anthropic' | 'gemini';

/** 全部合法的云端 API 格式，设置项校验与前端下拉共用。 */
export const AI_API_FORMATS: readonly AiApiFormat[] = ['openai', 'anthropic', 'gemini'];

/**
 * 各 API 类型里由 SDK 自动追加、不含版本路径的请求后缀。
 *
 * 三个 SDK 都以「完整 base URL（含 /v1 等版本路径）」为起点再追加动作路径：
 * openai-compatible 拼 /chat/completions，anthropic 拼 /messages，google 拼
 * models/{model}:generateContent（含模型名，不纳入自定义路径校验）。
 */
const SDK_REQUEST_SUFFIX: Record<Exclude<AiApiFormat, 'gemini'>, string> = {
    openai: '/chat/completions',
    anthropic: '/messages',
};

/**
 * 由接口基础地址与可选请求路径计算 SDK 使用的 base URL。
 *
 * 请求路径用于厂商的非标端点：填了就整体接在基础地址之后（此时基础地址
 * 通常不含版本路径），因此必须以该 API 类型的标准动作后缀结尾；剥掉后缀
 * 的剩余部分（即版本路径）拼回基础地址，交给 SDK 后由它追加动作后缀，
 * 最终请求的 URL 与用户填写的一致。留空表示走标准路径，基础地址原样使用。
 *
 * @param endpoint 基础地址（含版本路径，如 https://api.deepseek.com/v1）。
 * @param requestPath 完整请求路径覆盖（如 /v1/messages）；空串表示标准路径。
 * @param apiFormat API 兼容格式。
 * @returns 可直接传给各 SDK provider 的 baseURL。
 * @throws 请求路径不以 / 开头、与 API 类型不匹配，或 gemini 格式带自定义路径时显式抛错。
 */
export const resolveAiRequestBaseUrl = (endpoint: string, requestPath: string, apiFormat: AiApiFormat): string => {
    if (requestPath.length === 0) {
        return endpoint;
    }
    if (!requestPath.startsWith('/')) {
        throw new Error(`请求路径必须以 / 开头: ${requestPath}`);
    }
    if (apiFormat === 'gemini') {
        throw new Error('gemini 格式的请求路径含模型名，暂不支持自定义，请留空');
    }
    const suffix = SDK_REQUEST_SUFFIX[apiFormat];
    if (!requestPath.endsWith(suffix)) {
        throw new Error(`请求路径 ${requestPath} 与 ${apiFormat} 格式不匹配：需以 ${suffix} 结尾`);
    }
    const versionPath = requestPath.slice(0, requestPath.length - suffix.length);
    return versionPath ? joinUrl(endpoint, versionPath) : endpoint;
};
