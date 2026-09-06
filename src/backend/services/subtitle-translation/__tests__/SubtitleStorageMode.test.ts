import { describe, expect, it } from 'vitest';
import { buildSubtitleStorageMode } from '@/backend/services/subtitle-translation/SubtitleTranslationStorageMode';

/**
 * 字幕翻译缓存键是"引擎#模型#模式#风格签名"的稳定契约：
 * 切换引擎、模型、模式或风格中的任何一项都必须落到不同的缓存分区，
 * 否则切换后会把旧配置的译文当作缓存命中复用。
 */
describe('字幕翻译缓存键按配置隔离', () => {
    it('本地引擎的缓存键包含使用中的模型 ID，不同模型互不复用缓存', () => {
        const small = buildSubtitleStorageMode('local', 'qwen3.5-0.8b-q4_k_m', 'zh', 'sig');
        const large = buildSubtitleStorageMode('local', 'qwen3.5-4b-q4_k_m', 'zh', 'sig');
        expect(small).toBe('local#qwen3.5-0.8b-q4_k_m#zh#sig');
        expect(large).toBe('local#qwen3.5-4b-q4_k_m#zh#sig');
        expect(small).not.toBe(large);
    });

    it('云端引擎的缓存键包含路由到的模型 ID，与本地引擎互不复用缓存', () => {
        const cloud = buildSubtitleStorageMode('openai', 'gpt-5.4-nano', 'zh', 'sig');
        const local = buildSubtitleStorageMode('local', 'gpt-5.4-nano', 'zh', 'sig');
        expect(cloud).toBe('openai#gpt-5.4-nano#zh#sig');
        expect(cloud).not.toBe(local);
    });

    it('模型 ID 自带的下划线不会破坏 # 分段，各段都能正确辨认', () => {
        const mode = buildSubtitleStorageMode('local', 'qwen3.5-2b-q4_k_m', 'simple_en', 'abc123');
        expect(mode.split('#')).toEqual(['local', 'qwen3.5-2b-q4_k_m', 'simple_en', 'abc123']);
    });

    it('不同的翻译模式或风格签名产生不同的缓存键', () => {
        const zh = buildSubtitleStorageMode('openai', 'gpt-5.4-nano', 'zh', 'sig');
        const simpleEn = buildSubtitleStorageMode('openai', 'gpt-5.4-nano', 'simple_en', 'sig');
        const otherStyle = buildSubtitleStorageMode('openai', 'gpt-5.4-nano', 'zh', 'other');
        expect(new Set([zh, simpleEn, otherStyle]).size).toBe(3);
    });
});
