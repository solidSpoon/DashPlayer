/** 手机页主题。 */
export type AppTheme = 'light' | 'dark';

/** localStorage 主题键；index.html 里的首屏脚本也硬编码了这个值，必须保持一致。 */
export const THEME_STORAGE_KEY = 'dashplayer.mobile.theme';

/** 浏览器地址栏 / 状态栏颜色。 */
const THEME_COLORS: Record<AppTheme, string> = {
    light: '#f5f4f0',
    dark: '#0b0b0b',
};

/** 播放页顶端的媒体栏颜色：黑色，视频和圆钮都压在它下面。 */
export const WATCH_CHROME_COLOR = '#000000';

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
 * 把状态栏颜色同步成当前页面该用的颜色。
 *
 * 播放页顶端是黑色媒体栏（见 mobile.css 里 html[data-page='watch'] 那几条），
 * 状态栏就该跟着变黑，否则浅色主题下会是一条奶油色的栏压在黑视频上面。
 *
 * @param theme 主题。
 */
const syncChromeColor = (theme: AppTheme): void => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
        return;
    }
    const onWatch = document.documentElement.dataset.page === 'watch';
    meta.content = onWatch ? WATCH_CHROME_COLOR : THEME_COLORS[theme];
};

/**
 * 把主题应用到根节点和浏览器状态栏。
 *
 * @param theme 主题。
 */
export const applyTheme = (theme: AppTheme): void => {
    document.documentElement.dataset.theme = theme;
    syncChromeColor(theme);
};

/**
 * 标记当前页面是列表页还是播放页。
 *
 * 只用来切顶部媒体栏的配色（播放页黑、列表页跟主题），样式里靠
 * `html[data-page='watch']` 选择，避免为了一个色块在组件里写行内样式。
 *
 * @param page 页面标识。
 */
export const setPageChrome = (page: 'list' | 'watch'): void => {
    document.documentElement.dataset.page = page;
    syncChromeColor(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
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
