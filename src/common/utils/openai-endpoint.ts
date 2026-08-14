import { joinUrl } from '@/common/utils/Util';

/**
 * 按“是否自动追加 /v1”开关计算 OpenAI 兼容接口的有效 base URL。
 *
 * 行为说明：
 * - 开关为布尔字符串（'true'/'false'），非法值立即抛错，不做隐式回退；
 * - 开启时在接口地址后追加 /v1（如 https://api.example.com → https://api.example.com/v1）；
 * - 关闭时按原地址使用，地址需自带 /v1 路径。
 *
 * @param endpoint 用户配置的接口地址（不含 /v1）。
 * @param rawAutoAppendV1 设置项 apiKeys.openAi.autoAppendV1 的原始字符串值。
 * @returns 拼接后的有效 base URL。
 */
export const resolveOpenAiBaseUrl = (endpoint: string, rawAutoAppendV1: string): string => {
    if (rawAutoAppendV1 !== 'true' && rawAutoAppendV1 !== 'false') {
        throw new Error(`设置项 apiKeys.openAi.autoAppendV1 非法: ${rawAutoAppendV1}`);
    }
    return rawAutoAppendV1 === 'true' ? joinUrl(endpoint, '/v1') : endpoint;
};
