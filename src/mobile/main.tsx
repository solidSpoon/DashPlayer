import React from 'react';
import { createRoot } from 'react-dom/client';
import MobileApp from './MobileApp';
import { ensureListHistory, seedListHistory } from './lib';
import { applyTheme, readTheme } from './theme';
import './mobile.css';

applyTheme(readTheme());

// 直接打开播放页时先补出列表页历史，见 seedListHistory。
seedListHistory();
// 浏览器恢复会话会清掉标签页历史且不重新执行脚本，页面重新活过来时再补一次。
window.addEventListener('pageshow', ensureListHistory);
window.addEventListener('focus', ensureListHistory);
window.addEventListener('touchstart', ensureListHistory, { passive: true });
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        ensureListHistory();
    }
});

const container = document.getElementById('root');
if (!container) {
    throw new Error('手机页缺少 #root 容器');
}

createRoot(container).render(<MobileApp />);
