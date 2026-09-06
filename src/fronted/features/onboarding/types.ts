/**
 * 引导流程内共享的类型定义。
 */

/** 引导引擎步骤的最终选择结果；skipped 表示用户跳过了引擎配置。 */
export type OnboardingEngineChoice =
    /** 已选择并应用本地引擎，记录启用的模型展示名。 */
    | { type: 'local'; modelName: string }
    /** 已选择并应用云端 OpenAI 接口。 */
    | { type: 'cloud' };
