import { Navigate, useParams } from 'react-router-dom';
import WatchPage from './WatchPage';
import { PENDING_WATCH_KEY } from './lib';

/**
 * 本次页面加载是否直接从播放页 URL 进入。
 *
 * 正常从列表点进来时 hash 是 `#/`，不需要补列表历史；直接打开、刷新或
 * 浏览器恢复详情页时 hash 是 `#/watch/...`，要先绕回列表再推入详情，
 * 这样返回键才有列表可回。
 */
const bootedAtWatch = /^#\/watch(\/|$)/.test(window.location.hash);
let needsWatchBootstrap = bootedAtWatch;

/**
 * 播放页路由入口。
 *
 * 直接进入详情页时先把视频 ID 交给列表页，替换成列表历史，再由列表页
 * 推入详情页。列表页消费后会清掉临时值，返回时不会再次跳回详情。
 */
const WatchRoute = () => {
    const { id } = useParams<{ id: string }>();

    if (id && needsWatchBootstrap) {
        needsWatchBootstrap = false;
        try {
            sessionStorage.setItem(PENDING_WATCH_KEY, id);
        } catch {
            // 浏览器禁用 sessionStorage 时保持直接打开，不额外绕列表。
            return <WatchPage />;
        }
        return <Navigate to="/" replace />;
    }

    return <WatchPage />;
};

export default WatchRoute;
