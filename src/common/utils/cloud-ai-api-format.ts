/** 云端 API 兼容格式：OpenAI chat completions、Anthropic messages、Gemini generateContent。 */
export type AiApiFormat = 'openai' | 'anthropic' | 'gemini';

/** 全部合法的云端 API 格式，设置项校验与前端下拉共用。 */
export const AI_API_FORMATS: readonly AiApiFormat[] = ['openai', 'anthropic', 'gemini'];
