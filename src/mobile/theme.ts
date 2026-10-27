/** 手机页主题。 */
export type AppTheme = 'light' | 'dark';

/** localStorage 主题键；index.html 里的首屏脚本也硬编码了这个值，必须保持一致。 */
export const THEME_STORAGE_KEY = 'dashplayer.mobile.theme';

/** 浏览器地址栏 / 状态栏颜色。 */
const THEME_COLORS: Record<AppTheme, string> = {
    light: '#f5f4f0',
    dark: '#0b0b0b',
};

/**
 * 读取已保存的主题；没存过时保持当前的深色默认。
 *
 * @returns 主题。
 */
export const readTheme = (): AppTheme => {
    try {
        return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
    } catch {
        return 'dark';
    }
};

/**
 * 把主题应用到根节点和浏览器状态栏。
 *
 * @param theme 主题。
 */
export const applyTheme = (theme: AppTheme): void => {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) {
        meta.content = THEME_COLORS[theme];
    }
};

/**
 * 保存主题偏好。
 *
 * @param theme 主题。
 */
export const saveTheme = (theme: AppTheme): void => {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
        // 隐私模式下只影响下次打开，不影响当前页面。
    }
};
