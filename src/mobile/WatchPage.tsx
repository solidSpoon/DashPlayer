import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Virtuoso } from 'react-virtuoso';
import type { MobileWatchDetail } from '@/common/contracts/mobile-web';
import { mobileApi } from './api';
import DictionaryBar from './DictionaryBar';
import MainSubtitle from './MainSubtitle';
import PauseMenu from './PauseMenu';
import PlaybackControls from './PlaybackControls';
import SettingsSheet from './SettingsSheet';
import SubtitleRow from './SubtitleRow';
import { t } from './lib';
import { useWatchPlayer } from './useWatchPlayer';

/**
 * 播放页主体：视频、字幕列表、底部三键和设置面板。
 *
 * 播放器返回值在这里**逐个解构**，不要改回 `player.xxx` 的写法：
 * useWatchPlayer 的返回对象里同时装着若干个 ref（videoRef / virtuosoRef /
 * dictRef / scrollerRef），React Compiler 会把「装着 ref 的对象」整体当成
 * ref 结构，于是渲染期读它的任何属性都会被 `react-hooks/refs` 判为
 * “Cannot access refs during render”。解构后每个字段各自独立，编译器只把
 * 真正的 ref 当 ref，也能正常为这个组件做记忆化。
 *
 * @param detail 播放详情。
 */
const WatchPlayer = ({ detail }: { detail: MobileWatchDetail }) => {
    const {
        videoRef,
        virtuosoRef,
        dictRef,
        handleScrollerRef,
        currentIndex,
        currentLine,
        currentTranslation,
        controlText,
        showEnglish,
        showTranslation,
        showFollow,
        videoError,
        paused,
        settingsOpen,
        dict,
        repeatOn,
        autoPauseOn,
        speed,
        theme,
        openSettings,
        closeSettings,
        toggleEnglish,
        toggleTranslation,
        followCurrent,
        toggleRepeat,
        toggleAutoPause,
        changeSpeed,
        changeTheme,
        seekLine,
        stepLine,
        replayCurrent,
        lookupWord,
        handleScroll,
        handleUserScroll,
        handleRangeChanged,
        handleLoadedMetadata,
        handleTimeUpdate,
        handleSeeking,
        handleSeeked,
        handlePause,
        handlePlay,
        handleEnded,
        handleError,
        handleLoadedData,
    } = useWatchPlayer(detail);
    const navigate = useNavigate();
    const pauseMenuOpen = paused && !videoError;

    return (
        <div className="view watch">
            <div className={`player${detail.isAudio ? ' audio' : ''}`}>
                {/* 字幕由页面自绘，不使用 WebVTT track，关闭 jsx-a11y 的 captions 规则。 */}
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                    ref={videoRef}
                    controls
                    playsInline
                    preload="metadata"
                    src={detail.streamUrl}
                    onLoadedMetadata={handleLoadedMetadata}
                    onTimeUpdate={handleTimeUpdate}
                    onSeeking={handleSeeking}
                    onSeeked={handleSeeked}
                    onPause={handlePause}
                    onPlay={handlePlay}
                    onEnded={handleEnded}
                    onError={handleError}
                    onLoadedData={handleLoadedData}
                />
                {videoError && (
                    <div className="video-note">
                        <div className="video-note-title">
                            {t('手机浏览器放不了这个格式', 'This format cannot play in the phone browser')}
                        </div>
                        <div className="video-note-text">
                            {t(
                                '可以回到电脑上，用 DashPlayer 的「播放修复」生成 MP4 后再试。',
                                'Run Playback Repair in DashPlayer on your computer to make an MP4, then try again.',
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="subs-wrap">
                <MainSubtitle
                    line={currentLine}
                    translation={currentTranslation}
                    showEnglish={showEnglish}
                    showTranslation={showTranslation}
                    onWord={lookupWord}
                    onLongPress={openSettings}
                />
                <div
                    className={pauseMenuOpen ? 'subs menu-open' : 'subs'}
                    onTouchMove={handleUserScroll}
                    onWheel={handleUserScroll}
                >
                    {detail.subtitles.length === 0 ? (
                        <div className="subs-empty">
                            {t('这个视频没有匹配到字幕。', 'No subtitles matched this video.')}
                        </div>
                    ) : (
                        <Virtuoso
                            ref={virtuosoRef}
                            scrollerRef={handleScrollerRef}
                            style={{ height: '100%' }}
                            data={detail.subtitles}
                            computeItemKey={(index) => index}
                            defaultItemHeight={70}
                            increaseViewportBy={200}
                            minOverscanItemCount={{ top: 3, bottom: 6 }}
                            onScroll={handleScroll}
                            rangeChanged={handleRangeChanged}
                            itemContent={(index, line) => (
                                <SubtitleRow
                                    line={line}
                                    index={index}
                                    active={index === currentIndex}
                                    onSeek={seekLine}
                                />
                            )}
                        />
                    )}
                </div>
                {showFollow && (
                    <button type="button" className="follow-btn" onClick={followCurrent}>
                        {t('回到当前', 'Back to current')}
                    </button>
                )}
            </div>

            <div className="controls-wrap">
                <PlaybackControls
                    hasSubtitles={detail.subtitles.length > 0}
                    text={controlText}
                    onPrevious={() => stepLine(-1)}
                    onCurrent={replayCurrent}
                    onNext={() => stepLine(1)}
                />
                <PauseMenu
                    open={pauseMenuOpen}
                    onSettings={openSettings}
                    onHome={() => navigate('/', { replace: true })}
                />
            </div>

            <SettingsSheet
                open={settingsOpen}
                onClose={closeSettings}
                showEnglish={showEnglish}
                showTranslation={showTranslation}
                onToggleEnglish={toggleEnglish}
                onToggleTranslation={toggleTranslation}
                repeatOn={repeatOn}
                onToggleRepeat={toggleRepeat}
                autoPauseOn={autoPauseOn}
                onToggleAutoPause={toggleAutoPause}
                speed={speed}
                onChangeSpeed={changeSpeed}
                theme={theme}
                onChangeTheme={changeTheme}
            />

            <DictionaryBar ref={dictRef} dict={dict} />
        </div>
    );
};

/**
 * 单个视频的加载外壳：负责拉详情，拿到后挂播放器。
 *
 * 外层用 `key={id}` 挂载它，换视频时组件整体重挂、state 自然回到初始值；
 * 因此**不要**在 effect 里先 setState(null) 清空旧数据（那是同步 setState，
 * 只会多一轮级联渲染），也不要换成在 effect 里比对 id 再改 state 的写法。
 *
 * @param videoId 已确认非空的视频标识。
 */
const WatchDetailLoader = ({ videoId }: { videoId: string }) => {
    const [detail, setDetail] = React.useState<MobileWatchDetail | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        let cancelled = false;
        document.title = 'DashPlayer';
        mobileApi.getWatchDetail(videoId)
            .then((next) => {
                if (cancelled) {
                    return;
                }
                setDetail(next);
                document.title = `${next.title || 'DashPlayer'} · DashPlayer`;
            })
            .catch((reason: unknown) => {
                if (!cancelled) {
                    setError(reason instanceof Error ? reason.message : String(reason));
                }
            });
        return () => {
            cancelled = true;
        };
    }, [videoId]);

    if (error !== null) {
        return (
            <div className="view watch">
                <div className="state">
                    <div className="state-title">{t('打不开这个视频', 'Cannot open this video')}</div>
                    <div className="state-text">{error}</div>
                    <Link className="retry-btn" to="/">
                        {t('返回最近播放', 'Back to recent plays')}
                    </Link>
                </div>
            </div>
        );
    }

    if (!detail) {
        return (
            <div className="view watch">
                <div className="state">
                    <div className="state-title">{t('正在加载…', 'Loading…')}</div>
                </div>
            </div>
        );
    }

    return <WatchPlayer key={detail.id} detail={detail} />;
};

/**
 * 手机版播放页：校验视频标识后交给加载外壳。
 */
const WatchPage = () => {
    const { id } = useParams<{ id: string }>();
    if (!id) {
        return (
            <div className="view watch">
                <div className="state">
                    <div className="state-title">{t('打不开这个视频', 'Cannot open this video')}</div>
                    <div className="state-text">{t('缺少视频标识', 'Missing video id')}</div>
                    <Link className="retry-btn" to="/">
                        {t('返回最近播放', 'Back to recent plays')}
                    </Link>
                </div>
            </div>
        );
    }
    return <WatchDetailLoader key={id} videoId={id} />;
};

export default WatchPage;
