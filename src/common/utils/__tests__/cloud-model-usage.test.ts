import { describe, expect, it } from 'vitest';
import { computeCloudModelUsage } from '../cloud-model-usage';

describe('computeCloudModelUsage', () => {
    it('功能切走引擎或关闭后，槽位残留的旧模型不再算占用', () => {
        const usage = computeCloudModelUsage({
            sentenceLearningEnabled: false,
            subtitleTranslationEngine: 'local-mt',
            dictionaryEngine: 'none',
            modelSlots: {
                sentenceLearning: 'gpt-5.4-nano',
                subtitleTranslation: 'gpt-5.4-nano',
                dictionary: 'gpt-5.4-nano',
            },
        });

        expect(usage).toEqual({
            sentenceLearning: '',
            subtitleTranslation: '',
            dictionary: '',
        });
    });

    it('功能真的走云端时，占用它槽位里记的模型', () => {
        const usage = computeCloudModelUsage({
            sentenceLearningEnabled: true,
            subtitleTranslationEngine: 'openai',
            dictionaryEngine: 'local',
            modelSlots: {
                sentenceLearning: 'gpt-5.4-nano',
                subtitleTranslation: 'deepseek-flash',
                dictionary: 'gpt-5.4-nano',
            },
        });

        expect(usage).toEqual({
            sentenceLearning: 'gpt-5.4-nano',
            subtitleTranslation: 'deepseek-flash',
            dictionary: '',
        });
    });

    it('引擎存储值非法（占位）时不视为走云端', () => {
        const usage = computeCloudModelUsage({
            sentenceLearningEnabled: true,
            subtitleTranslationEngine: 'invalid',
            dictionaryEngine: 'openai',
            modelSlots: {
                sentenceLearning: 'gpt-5.4-nano',
                subtitleTranslation: 'gpt-5.4-nano',
                dictionary: 'deepseek-flash',
            },
        });

        expect(usage.subtitleTranslation).toBe('');
        expect(usage.dictionary).toBe('deepseek-flash');
    });
});
