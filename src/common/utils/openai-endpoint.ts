import { joinUrl } from '@/common/utils/Util';

/** 云端 API 兼容格式：OpenAI chat completions、Anthropic messages、Gemini generateContent。 */
export type AiApiFormat = 'openai' | 'anthropic' | 'gemini';

/** 全部合法的云端 API 格式，设置项校验与预设校验共用。 */
export const AI_API_FORMATS: readonly AiApiFormat[] = ['openai', 'anthropic', 'gemini'];

/**
 * 各 API 格式在开启「自动追加版本路径」时拼接的前缀：
 * - openai/anthropic 的 SDK 以带 /v1 的地址为 baseURL；
 * - gemini 的 SDK 以带 /v1beta 的地址为 baseURL。
 */
const VERSION_PATH_BY_FORMAT: Record<AiApiFormat, string> = {
    openai: '/v1',
    anthropic: '/v1',
    gemini: '/v1beta',
};

/**
 * 按「API 格式 + 是否自动追加版本路径」计算云端接口的有效 base URL。
 *
 * 行为说明：
 * - apiFormat 与 autoAppendV1 均为严格校验，非法值立即抛错，不做隐式回退；
 * - 开启时按格式追加版本路径（openai/anthropic 追加 /v1，gemini 追加 /v1beta），
 *   如 https://api.example.com → https://api.example.com/v1；
 * - 关闭时按原地址使用，地址需自带版本路径。
 *
 * @param endpoint 用户配置的接口地址（不含版本路径）。
 * @param apiFormat 设置项 apiKeys.openAi.apiFormat 的原始值。
 * @param rawAutoAppendV1 设置项 apiKeys.openAi.autoAppendV1 的原始字符串值。
 * @returns 拼接后的有效 base URL。
 */
export const resolveAiBaseUrl = (endpoint: string, apiFormat: string, rawAutoAppendV1: string): string => {
    if (!AI_API_FORMATS.includes(apiFormat as AiApiFormat)) {
        throw new Error(`设置项 apiKeys.openAi.apiFormat 非法: ${apiFormat}`);
    }
    if (rawAutoAppendV1 !== 'true' && rawAutoAppendV1 !== 'false') {
        throw new Error(`设置项 apiKeys.openAi.autoAppendV1 非法: ${rawAutoAppendV1}`);
    }
    return rawAutoAppendV1 === 'true' ? joinUrl(endpoint, VERSION_PATH_BY_FORMAT[apiFormat as AiApiFormat]) : endpoint;
};
