import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { MobileRecentItem } from '@/common/contracts/mobile-web';
import { mobileApi } from './api';
import HelpDiagram from './HelpDiagram';
import { PENDING_WATCH_KEY, formatClock, formatRelative, t } from './lib';
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
    const navigate = useNavigate();
    const [pendingWatchId] = React.useState<string | null>(() => {
        try {
            const id = sessionStorage.getItem(PENDING_WATCH_KEY);
            sessionStorage.removeItem(PENDING_WATCH_KEY);
            return id;
        } catch {
            return null;
        }
    });
    const [items, setItems] = React.useState<MobileRecentItem[] | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [reloadToken, setReloadToken] = React.useState(0);
    const [theme, setTheme] = React.useState(() => readTheme());
    const [helpOpen, setHelpOpen] = React.useState(false);
    const pendingRedirectedRef = React.useRef(false);

    React.useEffect(() => {
        document.title = 'DashPlayer';
    }, []);

    React.useEffect(() => {
        if (!pendingWatchId || pendingRedirectedRef.current) {
            return;
        }
        pendingRedirectedRef.current = true;
        navigate(`/watch/${encodeURIComponent(pendingWatchId)}`);
    }, [navigate, pendingWatchId]);

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
        if (pendingWatchId) {
            return;
        }
        let cancelled = false;
        setItems(null);
        setError(null);
        mobileApi.listRecent()
            .then((next) => {
                if (!cancelled) {
                    setItems(next);
                }
            })
            .catch((reason: unknown) => {
                if (!cancelled) {
                    setError(reason instanceof Error ? reason.message : String(reason));
                }
            });
        return () => {
            cancelled = true;
        };
    }, [pendingWatchId, reloadToken]);

    if (pendingWatchId) {
        return <div className="view" />;
    }

    return (
        <div className="view">
            <div className="home-scroll">
                <div className="home-head">
                    <h1 className="home-title">{t('最近播放', 'Recently played')}</h1>
                    <div className="home-actions">
                        <button
                            type="button"
                            className="theme-toggle"
                            aria-label={theme === 'dark'
                                ? t('切换到浅色模式', 'Switch to light mode')
                                : t('切换到深色模式', 'Switch to dark mode')}
                            onClick={toggleTheme}
                        >
                            {theme === 'dark' ? t('浅色', 'Light') : t('深色', 'Dark')}
                        </button>
                        <button
                            type="button"
                            className="help-btn"
                            aria-label={t('使用说明', 'Help')}
                            onClick={() => setHelpOpen(true)}
                        >
                            ?
                        </button>
                    </div>
                </div>

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

            {helpOpen && (
                <div className="sheet-layer">
                    <button
                        type="button"
                        className="sheet-backdrop"
                        aria-label={t('关闭', 'Close')}
                        onClick={() => setHelpOpen(false)}
                    />
                    <div
                        className="sheet"
                        role="dialog"
                        aria-modal="true"
                        aria-label={t('播放页操作', 'Playback gestures')}
                    >
                        <div className="sheet-head">
                            <div className="sheet-title">{t('播放页操作', 'Playback gestures')}</div>
                            <button
                                type="button"
                                className="sheet-done"
                                onClick={() => setHelpOpen(false)}
                            >
                                {t('关闭', 'Close')}
                            </button>
                        </div>
                        <HelpDiagram />
                        <div className="help-body">
                            <p className="help-line">
                                <strong>{t('长按主字幕区', 'Long-press the main subtitle')}</strong>
                                {t('，打开播放设置。', ' to open playback settings.')}
                            </p>
                            <p className="help-line">
                                {t(
                                    '主字幕区点单词查词；点下面的英文句子，从该句开始播放。',
                                    'Tap a word in the main subtitle to look it up; tap a line below to play from it.',
                                )}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RecentPage;
