/**
 * 让应用外壳的高度跟真正的窗口（布局视口）一致，写进 `--app-h`。
 *
 * 不能只用 CSS 的 `100dvh`：实测 iPhone 主屏 Web App（standalone）里 `100dvh` 比实际窗口短 60px
 * （窗口 874，dvh 814），`#root` 于是比屏幕矮一截，底部多出一条页面底色空带。
 * 量一张 402×874 的真机截图可以确认：底部空带 141 截图 px = 60 CSS px，而且那段是页面自己画的底色，
 * 不是系统留的条——说明文档画布盖到了整屏，布局视口就是 874，只是 `dvh` 少算了状态栏那一条。
 *
 * 所以不能用 `visualViewport.height`（它跟 `dvh` 一样少算），改用布局视口高度：
 * `documentElement.clientHeight` / `innerHeight` 取大者，两种环境（主屏 Web App、Safari 标签页）都对。
 */

/** 写入外壳高度的 CSS 变量名。 */
const APP_HEIGHT_VAR = '--app-h';

/**
 * 同步一次外壳高度：把布局视口高度写进 `--app-h`。
 *
 * 取 `clientHeight` 与 `innerHeight` 的较大值：前者是布局视口，后者在个别 iOS 版本上
 * 更接近实际高度；两个都拿不到就什么都不做，此时 CSS 里的 `100dvh` 兜底仍然生效。
 */
const syncAppHeight = (): void => {
    const height = Math.max(document.documentElement.clientHeight, window.innerHeight);
    if (!Number.isFinite(height) || height <= 0) {
        return;
    }
    document.documentElement.style.setProperty(APP_HEIGHT_VAR, `${Math.round(height)}px`);
};

/**
 * 启动时同步一次，并在视口变化时持续跟随。
 *
 * 需要监听三类事件：窗口 resize（旋转、上下分屏）、orientationchange（部分 iOS 版本只发这个）、
 * visualViewport 的 resize（地址栏收起、页面缩放会改它而不改窗口）。
 *
 * @returns 取消监听的函数，便于将来热重载时回收。
 */
export const watchAppHeight = (): () => void => {
    syncAppHeight();
    const onChange = (): void => syncAppHeight();
    window.addEventListener('resize', onChange);
    window.addEventListener('orientationchange', onChange);
    window.visualViewport?.addEventListener('resize', onChange);
    return () => {
        window.removeEventListener('resize', onChange);
        window.removeEventListener('orientationchange', onChange);
        window.visualViewport?.removeEventListener('resize', onChange);
    };
};
