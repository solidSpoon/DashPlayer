import { describe, expect, it } from 'vitest';
import { buildSubtitleStorageMode } from '@/backend/services/subtitle-translation/SubtitleTranslationStorageMode';

/**
 * 字幕翻译缓存键是"引擎#模型#模式#风格签名"的稳定契约：
 * 切换引擎、模型、模式或风格中的任何一项都必须落到不同的缓存分区，
 * 否则切换后会把旧配置的译文当作缓存命中复用。
 */
describe('字幕翻译缓存键按配置隔离', () => {
    it('本地引擎的缓存键包含使用中的模型 ID，不同模型互不复用缓存', () => {
        const catalog = buildSubtitleStorageMode('local', 'qwen3.5-2b-q4_k_m', 'zh', 'sig');
        const custom = buildSubtitleStorageMode('local', 'custom:my-qwen.gguf', 'zh', 'sig');
        expect(catalog).toBe('local#v2#qwen3.5-2b-q4_k_m#zh#sig');
        expect(custom).toBe('local#v2#custom:my-qwen.gguf#zh#sig');
        expect(catalog).not.toBe(custom);
    });

    it('本地引擎编入策略版本，策略进位后旧策略的缓存键不再命中', () => {
        const current = buildSubtitleStorageMode('local', 'qwen3.5-2b-q4_k_m', 'zh', 'sig');
        // 升级前的缓存键没有版本段；策略变化后旧分区必须失效，
        // 否则用户升级后继续读到按旧策略（本版要修的坏译文）缓存的字幕。
        const legacy = 'local#qwen3.5-2b-q4_k_m#zh#sig';
        expect(current).not.toBe(legacy);
    });

    it('云端引擎的缓存键包含路由到的模型 ID，与本地引擎互不复用缓存', () => {
        const cloud = buildSubtitleStorageMode('openai', 'gpt-5.4-nano', 'zh', 'sig');
        const local = buildSubtitleStorageMode('local', 'gpt-5.4-nano', 'zh', 'sig');
        expect(cloud).toBe('openai#gpt-5.4-nano#zh#sig');
        expect(cloud).not.toBe(local);
    });

    it('模型 ID 自带的下划线不会破坏 # 分段，各段都能正确辨认', () => {
        const mode = buildSubtitleStorageMode('local', 'qwen3.5-2b-q4_k_m', 'simple_en', 'abc123');
        expect(mode.split('#')).toEqual(['local', 'v2', 'qwen3.5-2b-q4_k_m', 'simple_en', 'abc123']);
    });

    it('不同的翻译模式或风格签名产生不同的缓存键', () => {
        const zh = buildSubtitleStorageMode('openai', 'gpt-5.4-nano', 'zh', 'sig');
        const simpleEn = buildSubtitleStorageMode('openai', 'gpt-5.4-nano', 'simple_en', 'sig');
        const otherStyle = buildSubtitleStorageMode('openai', 'gpt-5.4-nano', 'zh', 'other');
        expect(new Set([zh, simpleEn, otherStyle]).size).toBe(3);
    });

    it('轻量翻译引擎的缓存键不含风格签名也能与其他引擎隔离', () => {
        // 专用 MT 引擎固定输出中文、无风格概念，业务层固定传空签名。
        const mt = buildSubtitleStorageMode('local-mt', 'opus-mt-en-zh', 'zh', '');
        expect(mt).toBe('local-mt#opus-mt-en-zh#zh#');
        expect(mt).not.toBe(buildSubtitleStorageMode('local', 'opus-mt-en-zh', 'zh', ''));
    });
});
