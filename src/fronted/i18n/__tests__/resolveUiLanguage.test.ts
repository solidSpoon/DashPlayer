import { describe, expect, it } from 'vitest';
import { resolveUiLanguage } from '@/fronted/i18n/resolveUiLanguage';

describe('resolveUiLanguage', () => {
    it('uses system zh when setting is system', () => {
        expect(resolveUiLanguage('system', 'zh-CN')).toBe('zh-CN');
        expect(resolveUiLanguage('system', 'zh-Hans')).toBe('zh-CN');
    });

    it('uses system en when setting is system', () => {
        expect(resolveUiLanguage('system', 'en-US')).toBe('en-US');
        expect(resolveUiLanguage('system', 'fr-FR')).toBe('en-US');
    });

    it('respects explicit setting', () => {
        expect(resolveUiLanguage('zh-CN', 'en-US')).toBe('zh-CN');
        expect(resolveUiLanguage('en-US', 'zh-CN')).toBe('en-US');
    });
});
