/**
 * 外观主题选项。
 */
export type AppearanceTheme = 'dark' | 'light';

/**
 * 外观字号选项。
 */
export type AppearanceFontSize = 'fontSizeSmall' | 'fontSizeMedium' | 'fontSizeLarge';

/**
 * 界面语言选项。
 */
export type AppearanceLanguage = 'system' | 'zh-CN' | 'en-US';

/**
 * 外观设置详情/保存值对象。
 *
 * 详情与保存结构一致，统一在一个类型中，避免为相同字段结构重复声明。
 */
export interface AppearanceSettingVO {
    /** 主题。 */
    theme: AppearanceTheme;
    /** 字号。 */
    fontSize: AppearanceFontSize;
    /** 界面语言。 */
    language: AppearanceLanguage;
}
