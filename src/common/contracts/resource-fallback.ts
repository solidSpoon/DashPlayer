/**
 * 资源回退的公共契约。
 *
 * 云端与本地增强都建立在基础资源之上：它们不可用时，功能自动落到基础资源
 * （字幕翻译用轻量翻译、查词只用内置词库），并在这里登记状态，供设置页展示。
 */

/** 支持自动回退的功能。 */
export type FallbackFeature = 'subtitleTranslation' | 'dictionary';

/** 回退时落到的基础资源。 */
export type FallbackTarget = 'local-mt' | 'builtinDictionary';

/** 某个功能当前的回退状态。 */
export interface ResourceFallbackState {
    /** 功能标识。 */
    feature: FallbackFeature;
    /** 出问题的一档资源：`openai`、`local` 或具体模型标识。 */
    from: string;
    /** 实际落到的基础资源。 */
    to: FallbackTarget;
    /** 失败原因，用于排查，不直接展示给用户。 */
    reason: string;
    /** 回退发生时间（毫秒时间戳）。 */
    at: number;
    /** 冷却截止时间（毫秒时间戳）；词典回退在期内直接走基础资源，字幕回退仅作展示、每批仍重试原引擎。 */
    until: number;
}

/** 按功能索引的回退状态；未回退的功能为 null。 */
export type ResourceFallbackSnapshot = Record<FallbackFeature, ResourceFallbackState | null>;
