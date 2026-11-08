import React from 'react';
import { Link } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import type { MobileRecentItem } from '@/common/contracts/mobile-web';
import { mobileApi } from './api';
import { formatClock, formatRelative, t } from './lib';
import { applyTheme, readTheme, saveTheme } from './theme';

/**
 * 最近播放卡片。
 *
 * @param item 最近播放条目。
 */
const RecentCard = ({ item }: { item: MobileRecentItem }) => {
    const [thumbFailed, setThumbFailed] = React.useState(false);
    const showImage = !item.isAudio && !thumbFailed;
    const mediaClass = [
        'item-media',
        item.isAudio ? 'audio' : 'video',
        thumbFailed ? 'fallback' : '',
    ].filter(Boolean).join(' ');

    return (
        <Link className="item" to={`/watch/${encodeURIComponent(item.id)}`}>
            <div className={mediaClass}>
                {showImage && (
                    <img
                        alt=""
                        loading="lazy"
                        decoding="async"
                        src={item.thumbnailUrl}
                        onError={() => setThumbFailed(true)}
                    />
                )}
                <div className="item-fallback" />
                {item.position > 0 && (
                    <div className="item-pos">
                        {t(
                            `${item.isAudio ? '听到 ' : '看到 '}${formatClock(item.position)}`,
                            `At ${formatClock(item.position)}`,
                        )}
                    </div>
                )}
            </div>
            <div className="item-body">
                <div className="item-title">{item.title}</div>
                {item.subtitle && <div className="item-sub">{item.subtitle}</div>}
                <div className="item-meta">{formatRelative(item.updatedAt)}</div>
            </div>
        </Link>
    );
};

/**
 * 手机版最近播放页。
 */
const RecentPage = () => {
    // 列表数据与「它是第几次加载」绑在一起存：刷新时 reloadToken 变了，
    // 旧结果自然视为还没有，不需要在 effect 里同步 setItems(null) 清空
    // （那是一次同步 setState，会多一轮级联渲染）。
    const [loaded, setLoaded] = React.useState<{ token: number; items: MobileRecentItem[] } | null>(null);
    const [failure, setFailure] = React.useState<{ token: number; message: string } | null>(null);
    const [reloadToken, setReloadToken] = React.useState(0);
    const [theme, setTheme] = React.useState(() => readTheme());

    React.useEffect(() => {
        document.title = 'DashPlayer';
    }, []);

    /**
     * 在列表页直接切换浅色 / 深色，不用先打开一个视频。
     */
    const toggleTheme = (): void => {
        const next = theme === 'dark' ? 'light' : 'dark';
        setTheme(next);
        applyTheme(next);
        saveTheme(next);
    };

    React.useEffect(() => {
        let cancelled = false;
        mobileApi.listRecent()
            .then((next) => {
                if (!cancelled) {
                    setLoaded({ token: reloadToken, items: next });
                }
            })
            .catch((reason: unknown) => {
                if (!cancelled) {
                    setFailure({
                        token: reloadToken,
                        message: reason instanceof Error ? reason.message : String(reason),
                    });
                }
            });
        return () => {
            cancelled = true;
        };
    }, [reloadToken]);

    // 只有「当前这一次加载」的结果能上屏，上一轮的数据与错误一律当作没有
    const items = loaded !== null && loaded.token === reloadToken ? loaded.items : null;
    const error = failure !== null && failure.token === reloadToken ? failure.message : null;

    return (
        <div className="view home-view">
            <header className="home-head">
                <h1 className="home-title">{t('最近播放', 'Recently played')}</h1>
                <button
                    type="button"
                    className="theme-icon-btn"
                    aria-label={theme === 'dark'
                        ? t('切换到浅色模式', 'Switch to light mode')
                        : t('切换到深色模式', 'Switch to dark mode')}
                    onClick={toggleTheme}
                >
                    {theme === 'dark' ? (
                        <Sun size={20} strokeWidth={2.2} aria-hidden />
                    ) : (
                        <Moon size={20} strokeWidth={2.2} aria-hidden />
                    )}
                </button>
            </header>

            <div className="home-scroll">
                {error !== null && (
                    <div className="state">
                        <div className="state-title">{t('加载失败', 'Failed to load')}</div>
                        <div className="state-text">{error}</div>
                        <button
                            type="button"
                            className="retry-btn"
                            onClick={() => setReloadToken((value) => value + 1)}
                        >
                            {t('重试', 'Retry')}
                        </button>
                    </div>
                )}

                {error === null && items === null && (
                    <div className="list">
                        {Array.from({ length: 4 }, (_, index) => (
                            <div className="skeleton" key={index}>
                                <div className="sk-media" />
                                <div className="sk-line" />
                                <div className="sk-line short" />
                            </div>
                        ))}
                    </div>
                )}

                {error === null && items !== null && items.length === 0 && (
                    <div className="state">
                        <div className="state-title">{t('还没有播放记录', 'No recent plays yet')}</div>
                        <div className="state-text">
                            {t(
                                '先在电脑上的 DashPlayer 里打开一个视频，手机上就能接着看。',
                                'Open a video in DashPlayer on your computer first, then it will show up here.',
                            )}
                        </div>
                    </div>
                )}

                {error === null && items !== null && items.length > 0 && (
                    <div className="list">
                        {items.map((item) => (
                            <RecentCard key={item.id} item={item} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RecentPage;
