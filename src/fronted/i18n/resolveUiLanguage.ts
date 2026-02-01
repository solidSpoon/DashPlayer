export type UiLanguageSetting = 'system' | 'zh-CN' | 'en-US';
export type ResolvedLanguage = 'zh-CN' | 'en-US';

export function resolveUiLanguage(
    uiLanguageSetting: UiLanguageSetting,
    systemLanguage: string,
): ResolvedLanguage {
    if (uiLanguageSetting === 'zh-CN' || uiLanguageSetting === 'en-US') {
        return uiLanguageSetting;
    }
    return systemLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
}
