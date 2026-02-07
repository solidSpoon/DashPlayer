import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhNav from '@/fronted/i18n/locales/zh-CN/nav.json';
import enNav from '@/fronted/i18n/locales/en-US/nav.json';
import zhSettings from '@/fronted/i18n/locales/zh-CN/settings.json';
import enSettings from '@/fronted/i18n/locales/en-US/settings.json';
import zhToast from '@/fronted/i18n/locales/zh-CN/toast.json';
import enToast from '@/fronted/i18n/locales/en-US/toast.json';
import zhErrors from '@/fronted/i18n/locales/zh-CN/errors.json';
import enErrors from '@/fronted/i18n/locales/en-US/errors.json';
import zhPlayer from '@/fronted/i18n/locales/zh-CN/player.json';
import enPlayer from '@/fronted/i18n/locales/en-US/player.json';

export type AppLocale = 'zh-CN' | 'en-US';
export type AppLanguageSetting = 'system' | AppLocale;

export const I18N_FALLBACK_LOCALE: AppLocale = 'en-US';

export const resources = {
    'zh-CN': {
        nav: zhNav,
        settings: zhSettings,
        toast: zhToast,
        errors: zhErrors,
        player: zhPlayer,
    },
    'en-US': {
        nav: enNav,
        settings: enSettings,
        toast: enToast,
        errors: enErrors,
        player: enPlayer,
    },
};

type DotPrefix<T extends string> = T extends '' ? '' : `.${T}`;
type LeafKeys<T> = T extends string
    ? ''
    : {
        [K in Extract<keyof T, string>]: `${K}${DotPrefix<LeafKeys<T[K]>>}`;
    }[Extract<keyof T, string>];
type ResourceSchema = typeof resources['zh-CN'];
type NamespaceKeys = Extract<keyof ResourceSchema, string>;
export type TranslationKey = {
    [N in NamespaceKeys]: `${N}.${LeafKeys<ResourceSchema[N]>}`;
}[NamespaceKeys];

export const resolveLocaleFromSystem = (language: string | undefined | null): AppLocale => {
    if ((language ?? '').toLowerCase().startsWith('zh')) {
        return 'zh-CN';
    }
    return 'en-US';
};

export const resolveLocaleFromSetting = (
    setting: string | undefined | null,
    systemLanguage: string | undefined | null = typeof navigator === 'undefined' ? 'en-US' : navigator.language,
): AppLocale => {
    if (setting === 'zh-CN' || setting === 'en-US') {
        return setting;
    }
    if (setting === 'system') {
        return resolveLocaleFromSystem(systemLanguage);
    }
    return I18N_FALLBACK_LOCALE;
};

export const applyLanguageSetting = async (setting: string | undefined | null): Promise<AppLocale> => {
    const locale = resolveLocaleFromSetting(setting);
    if (i18n.resolvedLanguage !== locale) {
        await i18n.changeLanguage(locale);
    }
    return locale;
};

void i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: I18N_FALLBACK_LOCALE,
        fallbackLng: I18N_FALLBACK_LOCALE,
        interpolation: {
            escapeValue: false,
        },
        ns: ['nav', 'settings', 'toast', 'errors', 'player'],
        defaultNS: 'settings',
        returnNull: false,
        debug: import.meta.env.DEV,
        parseMissingKeyHandler: (key) => {
            if (import.meta.env.DEV) {
                console.warn(`[i18n] missing key: ${key}`);
            }
            return key;
        },
    });

export default i18n;
