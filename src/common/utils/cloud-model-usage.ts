/**
 * 云端模型的功能占用判定规则，main 与 renderer 共用。
 *
 * 占用是从引擎选择与功能开关推导出的事实，必须现算而非读持久化副本：
 * 功能模型槽位只是「上次选的模型」备忘，功能切走引擎或关闭后不会清理，
 * 直接采信会把残留值当成占用、导致模型删不掉。规则收在这一份纯函数里，
 * 后端删除拦截与前端「使用中」角标共用，避免两侧各写一遍后漂移。
 */

/** 云端模型的使用方（功能标识）。 */
export type OpenAiModelUsageFeature = 'sentenceLearning' | 'subtitleTranslation' | 'dictionary';

/** 全部功能标识；迭代顺序即展示顺序。 */
export const OPEN_AI_MODEL_USAGE_FEATURES: readonly OpenAiModelUsageFeature[] = [
    'sentenceLearning',
    'subtitleTranslation',
    'dictionary',
];

/** 占用判定的入参。 */
export type CloudModelUsageInputs = {
    /** 整句讲解功能是否启用。 */
    sentenceLearningEnabled: boolean;
    /** 字幕翻译引擎当前取值；'openai' 表示走云端，其余任何值（本地、关闭、非法占位）都不落云端。 */
    subtitleTranslationEngine: string;
    /** 词典引擎当前取值；判定同字幕翻译。 */
    dictionaryEngine: string;
    /** 各功能「上次选的云端模型」备忘；可能过期，仅当功能当前落云端时才采信。 */
    modelSlots: Record<OpenAiModelUsageFeature, string>;
};

/** 每个功能当前实际占用的云端模型标识；未占用为空字符串。 */
export type CloudModelUsage = Record<OpenAiModelUsageFeature, string>;

/**
 * 现算每个功能当前实际占用的云端模型。
 *
 * 判定规则：整句讲解需功能开关开启，字幕翻译与词典查词需对应引擎为
 * 'openai'；不满足条件的功能即使槽位有值也视为未占用。
 *
 * @param inputs 引擎选择、功能开关与各功能模型槽位。
 * @returns 功能 → 占用的模型标识；未占用为空字符串。
 */
export function computeCloudModelUsage(inputs: CloudModelUsageInputs): CloudModelUsage {
    const usesCloud = {
        sentenceLearning: inputs.sentenceLearningEnabled,
        subtitleTranslation: inputs.subtitleTranslationEngine === 'openai',
        dictionary: inputs.dictionaryEngine === 'openai',
    };
    return {
        sentenceLearning: usesCloud.sentenceLearning ? inputs.modelSlots.sentenceLearning : '',
        subtitleTranslation: usesCloud.subtitleTranslation ? inputs.modelSlots.subtitleTranslation : '',
        dictionary: usesCloud.dictionary ? inputs.modelSlots.dictionary : '',
    };
}
