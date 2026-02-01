import { useTranslation as useReactI18nTranslation } from 'react-i18next';

export type AppLanguage = 'zh-CN' | 'en-US';

export default function useI18n() {
    const { t, i18n } = useReactI18nTranslation();

    return {
        t,
        language: i18n.language,
        setLanguage: async (lng: AppLanguage) => i18n.changeLanguage(lng),
    };
}
