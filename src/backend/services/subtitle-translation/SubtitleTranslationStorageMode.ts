import { TranslationMode } from '@/common/types/TranslationResult';

/**
 * 字幕翻译缓存的持久化模式。
 *
 * 除 'tencent' 外统一用 '#' 分段：`openai#模型#模式#风格签名` 与
 * `local#模型#模式#风格签名`。不用 '_' 分段是因为模型 ID 自带下划线
 * （如 qwen3-0.6b-q4_k_m-v1），混在一起无法辨认分段边界。
 */
export type SubtitleTranslationStorageMode = 'tencent' | `openai#${string}` | `local#${string}`;

/**
 * 将云端/本地引擎、路由到的模型 ID、翻译模式与风格签名映射为持久化模式。
 *
 * 这是设置到缓存分区的唯一拼装点：播放调度与独立直翻都从这里取值，
 * 避免同一配置在多处重复拼装后产生不一致。
 *
 * @param engine 云端 'openai' 或本地 'local'。
 * @param modelId 云端字幕翻译当前路由到的模型 ID，或本地使用中的模型 ID。
 * @param mode 当前 OpenAI 字幕模式。
 * @param signature 当前风格签名。
 * @returns 用于按配置隔离缓存的持久化模式；分段分隔符约定见 SubtitleTranslationStorageMode。
 */
export const buildSubtitleStorageMode = (
    engine: 'openai' | 'local',
    modelId: string,
    mode: TranslationMode,
    signature: string
): SubtitleTranslationStorageMode => `${engine}#${modelId}#${mode}#${signature}`;
