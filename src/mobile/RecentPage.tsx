import React from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Moon, Sun } from 'lucide-react';
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
 * 手机版最近播放页：
 * - 顶栏一体化模糊渐隐；
 * - 支持切回前台自动静默刷新；
 * - 纯 GPU 硬件加速的 120fps 原生手感下拉刷新；
 * - 刷新指示器置于列表上方内衬中，随手势整体推开内容，绝不遮挡任何视频卡片。
 */
const RecentPage = () => {
    const [items, setItems] = React.useState<MobileRecentItem[] | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [isInitialLoading, setIsInitialLoading] = React.useState(true);
    const [reloadToken, setReloadToken] = React.useState(0);
    const [theme, setTheme] = React.useState(() => readTheme());

    const scrollRef = React.useRef<HTMLDivElement>(null);
    const contentRef = React.useRef<HTMLDivElement>(null);
    const indicatorRef = React.useRef<HTMLDivElement>(null);
    const spinnerRef = React.useRef<SVGSVGElement>(null);

    const lastFetchedTimeRef = React.useRef(0);
    const isFetchingRef = React.useRef(false);
    const isRefreshingRef = React.useRef(false);
    const itemsRef = React.useRef<MobileRecentItem[] | null>(null);

    // 将 items 同步给 ref，供网络回调安全读取
    React.useEffect(() => {
        itemsRef.current = items;
    });

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

    /**
     * 响应用户主动下拉或切回前台的静默刷新。
     *
     * @param silent 是否静默拉取。为 true 时保持当前列表，不切骨架屏。
     */
    const fetchList = React.useCallback(async (silent = false): Promise<void> => {
        const now = Date.now();
        // 静默刷新做 3 秒节流，防止频繁切换窗口反复请求
        if (silent && (isFetchingRef.current || now - lastFetchedTimeRef.current < 3000)) {
            return;
        }
        isFetchingRef.current = true;

        try {
            const next = await mobileApi.listRecent();
            setItems(next);
            setError(null);
            lastFetchedTimeRef.current = Date.now();
        } catch (reason: unknown) {
            const message = reason instanceof Error ? reason.message : String(reason);
            // 只有当前页面还没有数据时才展示全屏错误，已有列表时静默保留旧列表
            if (!silent || itemsRef.current === null) {
                setError(message);
            }
        } finally {
            isFetchingRef.current = false;
            setIsInitialLoading(false);
        }
    }, []);

    /**
     * 首次挂载与重试触发数据拉取。
     */
    React.useEffect(() => {
        let cancelled = false;
        mobileApi.listRecent()
            .then((next) => {
                if (cancelled) {
                    return;
                }
                setItems(next);
                setError(null);
                setIsInitialLoading(false);
                lastFetchedTimeRef.current = Date.now();
            })
            .catch((reason: unknown) => {
                if (cancelled) {
                    return;
                }
                setIsInitialLoading(false);
                const message = reason instanceof Error ? reason.message : String(reason);
                if (itemsRef.current === null) {
                    setError(message);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [reloadToken]);

    /**
     * 加载失败时手动重试。
     */
    const handleRetry = (): void => {
        setIsInitialLoading(true);
        setError(null);
        setReloadToken((prev) => prev + 1);
    };

    // 切回前台自动静默刷新（从其他 App 切回浏览器或熄屏解锁）
    React.useEffect(() => {
        const handleVisibilityChange = (): void => {
            if (document.visibilityState === 'visible') {
                void fetchList(true);
            }
        };
        const handleFocus = (): void => {
            void fetchList(true);
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleFocus);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleFocus);
        };
    }, [fetchList]);

    // 下拉刷新触控手势处理：直接操作 DOM 驱动 GPU 合成层，全程 0 次 React 重渲染
    React.useEffect(() => {
        const scroller = scrollRef.current;
        const content = contentRef.current;
        const indicator = indicatorRef.current;
        const spinner = spinnerRef.current;
        if (!scroller || !content || !indicator || !spinner) {
            return;
        }

        let startY = 0;
        let startX = 0;
        let identifier = -1;
        let pulling = false;
        let currentPull = 0;

        const setTransform = (pull: number, animate = false): void => {
            currentPull = pull;
            const easeCurve = 'cubic-bezier(0.18, 0.9, 0.28, 1)';
            if (animate) {
                content.style.transition = `transform 0.36s ${easeCurve}`;
                indicator.style.transition = 'opacity 0.22s ease';
            } else {
                content.style.transition = 'none';
                indicator.style.transition = 'none';
            }

            content.style.transform = pull > 0 ? `translate3d(0, ${pull}px, 0)` : '';

            if (pull <= 0) {
                indicator.style.opacity = '0';
                spinner.style.transform = '';
            } else {
                const progress = Math.min(1, Math.max(0, (pull - 8) / 40));
                indicator.style.opacity = `${progress}`;
                if (!isRefreshingRef.current) {
                    spinner.style.transform = `rotate(${pull * 6.5}deg)`;
                }
            }
        };

        const handleTouchStart = (event: TouchEvent): void => {
            if (event.touches.length !== 1 || isRefreshingRef.current) {
                return;
            }
            if (scroller.scrollTop > 0) {
                return;
            }
            const touch = event.touches[0];
            startY = touch.clientY;
            startX = touch.clientX;
            identifier = touch.identifier;
            pulling = false;
            currentPull = 0;
        };

        const handleTouchMove = (event: TouchEvent): void => {
            if (identifier === -1 || isRefreshingRef.current) {
                return;
            }
            const touch = Array.from(event.changedTouches).find((item) => item.identifier === identifier);
            if (!touch) {
                return;
            }

            const deltaY = touch.clientY - startY;
            const deltaX = touch.clientX - startX;

            if (!pulling) {
                // 向上推或横滑手势（如系统返回手势）不接管，交给系统与浏览器原生处理
                if (deltaY <= 0 || Math.abs(deltaX) > Math.abs(deltaY)) {
                    identifier = -1;
                    return;
                }
                // 仅当下拉且滚动在顶端时接管
                if (deltaY > 6 && scroller.scrollTop <= 0) {
                    pulling = true;
                }
            }

            if (pulling) {
                if (event.cancelable) {
                    event.preventDefault();
                }
                // 原生 iOS 分段平滑阻尼：初期 0.44 高度跟手，超过阈值后 0.18 柔和阻尼，封顶 76px
                const pull = deltaY <= 120
                    ? deltaY * 0.44
                    : 120 * 0.44 + (deltaY - 120) * 0.18;
                setTransform(Math.min(pull, 76), false);
            }
        };

        const finishPull = (): void => {
            if (!pulling) {
                identifier = -1;
                return;
            }
            pulling = false;
            identifier = -1;

            if (currentPull >= 48) {
                isRefreshingRef.current = true;
                indicator.classList.add('refreshing');
                setTransform(48, true);

                void fetchList(true).finally(() => {
                    setTimeout(() => {
                        setTransform(0, true);
                        setTimeout(() => {
                            indicator.classList.remove('refreshing');
                            isRefreshingRef.current = false;
                        }, 360);
                    }, 200);
                });
            } else {
                setTransform(0, true);
            }
        };

        scroller.addEventListener('touchstart', handleTouchStart, { passive: true });
        scroller.addEventListener('touchmove', handleTouchMove, { passive: false });
        scroller.addEventListener('touchend', finishPull, { passive: true });
        scroller.addEventListener('touchcancel', finishPull, { passive: true });

        return () => {
            scroller.removeEventListener('touchstart', handleTouchStart);
            scroller.removeEventListener('touchmove', handleTouchMove);
            scroller.removeEventListener('touchend', finishPull);
            scroller.removeEventListener('touchcancel', finishPull);
        };
    }, [fetchList]);

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

            <div className="home-scroll" ref={scrollRef}>
                <div className="home-scroll-inner" ref={contentRef}>
                    {/* 下拉刷新指示器：居于列表上方，随着下拉自然展露在留白区，始终在视频卡片上方 */}
                    <div className="home-pull-shelf" ref={indicatorRef} aria-hidden="true">
                        <div className="home-pull-badge">
                            <Loader2
                                ref={spinnerRef}
                                className="pull-spinner"
                                size={18}
                                strokeWidth={2.4}
                            />
                        </div>
                    </div>

                    {error !== null && (
                        <div className="state">
                            <div className="state-title">{t('加载失败', 'Failed to load')}</div>
                            <div className="state-text">{error}</div>
                            <button
                                type="button"
                                className="retry-btn"
                                onClick={handleRetry}
                            >
                                {t('重试', 'Retry')}
                            </button>
                        </div>
                    )}

                    {error === null && isInitialLoading && items === null && (
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

                    {error === null && !isInitialLoading && items !== null && items.length === 0 && (
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
        </div>
    );
};

export default RecentPage;
