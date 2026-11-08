import React from 'react';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import RecentPage from './RecentPage';
import WatchPage from './WatchPage';
import { setPageChrome } from './theme';

/**
 * 按当前路由切换顶部媒体栏配色。
 *
 * 播放页的视频、圆钮和状态栏都压在黑底上，列表页跟主题；用 layout effect
 * 让属性在首帧前就位，免得一瞬奶油色再变黑。
 */
const PageChrome = () => {
    const { pathname } = useLocation();
    React.useLayoutEffect(() => {
        setPageChrome(pathname.startsWith('/watch/') ? 'watch' : 'list');
    }, [pathname]);
    return null;
};

/**
 * 手机版应用路由。
 *
 * 用 HashRouter 是为了在手机浏览器里右滑返回时能正常回退，也不需要服务端做
 * SPA fallback；静态资源仍然由主进程的 HTTP 服务按路径直接提供。
 */
const MobileApp = () => {
    React.useEffect(() => {
        // 手机页不需要选中文字：长按主字幕区只用来开设置，避免弹出系统全选/复制菜单。
        const preventSelection = (event: Event): void => {
            event.preventDefault();
        };
        document.addEventListener('selectstart', preventSelection);
        document.addEventListener('contextmenu', preventSelection);
        return () => {
            document.removeEventListener('selectstart', preventSelection);
            document.removeEventListener('contextmenu', preventSelection);
        };
    }, []);

    return (
        <HashRouter>
            <PageChrome />
            <Routes>
                <Route path="/" element={<RecentPage />} />
                <Route path="/watch/:id" element={<WatchPage />} />
                <Route path="*" element={<RecentPage />} />
            </Routes>
        </HashRouter>
    );
};

export default MobileApp;
