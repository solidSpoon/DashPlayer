import { describe, it, expect } from 'vitest';
import { resolveProviderMigrationOutputs, type ProviderMigrationReads } from '../storeSchemaProviderMigrationV1';

/** 构造一份全空的旧配置线索，单测里按需覆盖个别字段。 */
const emptyReads = (): ProviderMigrationReads => ({
    subtitleProvider: null,
    legacySubtitleProvider: null,
    dictionaryProvider: null,
    legacyDictionaryProvider: null,
    sentenceLearningEnabled: null,
    legacySentenceLearningEnabled: null,
    subtitleMode: null,
    legacySubtitleMode: null,
    subtitleCustomStyle: null,
    legacySysConfSubtitleCustomStyle: null,
    availableModels: null,
    legacyDefaultModel: null,
    sentenceLearningModel: null,
    subtitleTranslationModel: null,
    dictionaryModel: null,
});

/** 取某个键的写入值；未写返回 undefined。 */
const writeOf = (outputs: ReturnType<typeof resolveProviderMigrationOutputs>, key: string): string | undefined =>
    outputs.find((output) => output.key === key)?.value;

describe('storeSchemaProviderMigrationV1 迁移决策', () => {
    it('旧词典引擎 youdao 不写盘，交给 schema 默认值 openai 接管', () => {
        const outputs = resolveProviderMigrationOutputs({
            ...emptyReads(),
            legacyDictionaryProvider: 'youdao',
        });

        expect(outputs.find((output) => output.key === 'providers.dictionary')).toBeUndefined();
    });

    it('旧字幕引擎 tencent 原样迁移到新键', () => {
        const outputs = resolveProviderMigrationOutputs({
            ...emptyReads(),
            legacySubtitleProvider: 'tencent',
        });

        expect(writeOf(outputs, 'providers.subtitleTranslation')).toBe('tencent');
    });

    it('引擎显式为 none 时不写盘，避免把默认推断固化到用户配置', () => {
        const outputs = resolveProviderMigrationOutputs({
            ...emptyReads(),
            subtitleProvider: 'none',
            dictionaryProvider: 'none',
        });

        expect(outputs.find((output) => output.key === 'providers.subtitleTranslation')).toBeUndefined();
        expect(outputs.find((output) => output.key === 'providers.dictionary')).toBeUndefined();
    });

    it('新键已有值时优先于历史键', () => {
        const outputs = resolveProviderMigrationOutputs({
            ...emptyReads(),
            subtitleProvider: 'openai',
            legacySubtitleProvider: 'tencent',
        });

        expect(writeOf(outputs, 'providers.subtitleTranslation')).toBe('openai');
    });

    it('旧句子学习开关 false 迁移为 false，其余显式值迁移为 true，未设置不写盘', () => {
        const off = resolveProviderMigrationOutputs({ ...emptyReads(), legacySentenceLearningEnabled: 'false' });
        const on = resolveProviderMigrationOutputs({ ...emptyReads(), legacySentenceLearningEnabled: 'true' });
        const unset = resolveProviderMigrationOutputs(emptyReads());

        expect(writeOf(off, 'features.openai.enableSentenceLearning')).toBe('false');
        expect(writeOf(on, 'features.openai.enableSentenceLearning')).toBe('true');
        expect(unset.find((output) => output.key === 'features.openai.enableSentenceLearning')).toBeUndefined();
    });

    it('旧翻译模式只认 simple_en/custom，其余一律归 zh', () => {
        const custom = resolveProviderMigrationOutputs({ ...emptyReads(), legacySubtitleMode: 'custom' });
        const unknown = resolveProviderMigrationOutputs({ ...emptyReads(), legacySubtitleMode: 'whatever' });

        expect(writeOf(custom, 'features.openai.subtitleTranslationMode')).toBe('custom');
        expect(writeOf(unknown, 'features.openai.subtitleTranslationMode')).toBe('zh');
    });

    it('候选模型不在可用列表时回落可用列表首项，列表为空时不写模型键', () => {
        const fallbackToFirst = resolveProviderMigrationOutputs({
            ...emptyReads(),
            availableModels: 'm1,m2',
            subtitleTranslationModel: 'gone',
        });
        const emptyAvailable = resolveProviderMigrationOutputs(emptyReads());

        expect(writeOf(fallbackToFirst, 'models.openai.subtitleTranslation')).toBe('m1');
        expect(emptyAvailable.find((output) => output.key === 'models.openai.subtitleTranslation')).toBeUndefined();
    });

    it('可用模型列表为空时不写盘，非空时按原序压缩写盘', () => {
        const none = resolveProviderMigrationOutputs(emptyReads());
        const some = resolveProviderMigrationOutputs({ ...emptyReads(), availableModels: ' m1 , m2 , m1 ' });

        expect(none.find((output) => output.key === 'models.openai.available')).toBeUndefined();
        expect(writeOf(some, 'models.openai.available')).toBe('m1,m2');
    });
});
