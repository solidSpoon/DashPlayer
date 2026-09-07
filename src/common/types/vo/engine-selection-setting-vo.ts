/**
 * 功能设置详情 VO。
 *
 * 枚举字段额外包含 `'invalid'` 占位值：表示设置仓库中的存储值不在当前版本
 * 的合法枚举内（常见于多分支开发后旧值残留）。详情读取不因此抛错，而是
 * 返回 `'invalid'` 占位并在 `invalidValues` 中带上原始存储值，让设置页
 * 仍能打开并显式提示用户重新选择；保存时遇 `'invalid'` 会跳过对应键。
 */
export type EngineSelectionSettingVO = {
    openai: {
        enableSentenceLearning: boolean;
        /** OpenAI 字幕输出风格；`'invalid'` 表示存储值非法，等待用户重新选择。 */
        subtitleTranslationMode: 'zh' | 'simple_en' | 'custom' | 'invalid';
        subtitleCustomStyle: string;
        featureModels: {
            sentenceLearning: string;
            subtitleTranslation: string;
            dictionary: string;
        };
    };
    providers: {
        /** 字幕翻译引擎；`'invalid'` 表示存储值非法，等待用户重新选择。 */
        subtitleTranslationEngine: 'openai' | 'tencent' | 'none' | 'invalid';
        /** 词典引擎；`'invalid'` 表示存储值非法，等待用户重新选择。 */
        dictionaryEngine: 'openai' | 'none' | 'invalid';
    };
    /**
     * 存储值不在当前合法枚举内的设置项。
     * 键为设置仓库键，值为存储的原始值；用户重新保存合法值后该项消失。
     */
    invalidValues: Partial<Record<
        'providers.subtitleTranslation' | 'providers.dictionary' | 'features.openai.subtitleTranslationMode',
        string
    >>;
};
