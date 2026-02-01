import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import enUS from '@/fronted/i18n/locales/en-US';
import zhCN from '@/fronted/i18n/locales/zh-CN';

export const i18n = i18next;

if (!i18n.isInitialized) {
    i18n
        .use(initReactI18next)
        .init({
            resources: {
                'zh-CN': { translation: zhCN },
                'en-US': { translation: enUS },
            },
            lng: 'zh-CN',
            fallbackLng: 'zh-CN',
            supportedLngs: ['zh-CN', 'en-US'],
            interpolation: {
                escapeValue: false,
            },
        })
        .catch(() => undefined);
}
