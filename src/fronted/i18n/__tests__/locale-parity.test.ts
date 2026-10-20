import { describe, expect, it } from 'vitest';
import { resources } from '@/fronted/i18n';

type Bundle = Record<string, unknown>;

const flatten = (obj: Bundle, prefix = ''): Map<string, string> => {
    const out = new Map<string, string>();
    Object.entries(obj).forEach(([key, value]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === 'object') {
            flatten(value as Bundle, path).forEach((v, k) => out.set(k, v));
        } else {
            out.set(path, String(value));
        }
    });
    return out;
};

const locales = ['en-US', 'zh-CN'] as const;
const namespaces = Object.keys(resources['en-US']) as (keyof typeof resources['en-US'])[];

describe('i18n locale parity', () => {
    it.each(namespaces)('namespace %s has the same keys in every locale', (ns) => {
        const en = flatten(resources['en-US'][ns] as Bundle);
        const zh = flatten(resources['zh-CN'][ns] as Bundle);

        const missingInZh = [...en.keys()].filter((key) => !zh.has(key));
        const missingInEn = [...zh.keys()].filter((key) => !en.has(key));

        expect({ missingInZh, missingInEn }).toEqual({ missingInZh: [], missingInEn: [] });
    });

    it.each(namespaces)('namespace %s has no blank translations', (ns) => {
        locales.forEach((locale) => {
            const blank = [...flatten(resources[locale][ns] as Bundle).entries()]
                .filter(([, value]) => value.trim() === '')
                .map(([key]) => key);
            expect({ locale, blank }).toEqual({ locale, blank: [] });
        });
    });

    it('keeps interpolation placeholders aligned across locales', () => {
        const placeholders = (value: string) => (value.match(/{{\s*[\w.]+\s*}}/g) ?? []).sort();

        namespaces.forEach((ns) => {
            const en = flatten(resources['en-US'][ns] as Bundle);
            const zh = flatten(resources['zh-CN'][ns] as Bundle);
            en.forEach((enValue, key) => {
                const zhValue = zh.get(key);
                if (zhValue === undefined) {
                    return;
                }
                expect({ key, en: placeholders(enValue), zh: placeholders(zhValue) })
                    .toEqual({ key, en: placeholders(enValue), zh: placeholders(enValue) });
            });
        });
    });
});
