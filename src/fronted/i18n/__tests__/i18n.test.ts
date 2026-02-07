import { describe, expect, it } from 'vitest';
import i18n, {
    applyLanguageSetting,
    I18N_FALLBACK_LOCALE,
    resolveLocaleFromSetting,
    resolveLocaleFromSystem,
} from '@/fronted/i18n';

describe('i18n locale resolution', () => {
    it('maps zh system locale to zh-CN', () => {
        expect(resolveLocaleFromSystem('zh-CN')).toBe('zh-CN');
        expect(resolveLocaleFromSystem('zh-TW')).toBe('zh-CN');
    });

    it('maps non-zh system locale to en-US', () => {
        expect(resolveLocaleFromSystem('en-US')).toBe('en-US');
        expect(resolveLocaleFromSystem('ja-JP')).toBe('en-US');
    });

    it('resolves explicit language setting directly', () => {
        expect(resolveLocaleFromSetting('zh-CN', 'en-US')).toBe('zh-CN');
        expect(resolveLocaleFromSetting('en-US', 'zh-CN')).toBe('en-US');
    });

    it('resolves system mode from system language', () => {
        expect(resolveLocaleFromSetting('system', 'zh-CN')).toBe('zh-CN');
        expect(resolveLocaleFromSetting('system', 'en-US')).toBe('en-US');
    });

    it('falls back to default locale for unknown value', () => {
        expect(resolveLocaleFromSetting('fr-FR', 'zh-CN')).toBe(I18N_FALLBACK_LOCALE);
    });

    it('applies language setting to i18n instance', async () => {
        await applyLanguageSetting('zh-CN');
        expect(i18n.resolvedLanguage).toBe('zh-CN');

        await applyLanguageSetting('system');
        expect(i18n.resolvedLanguage).toMatch(/^(zh-CN|en-US)$/);
    });
});
