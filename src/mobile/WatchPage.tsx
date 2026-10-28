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
 * @param detail 播放详情。
 */
const WatchPlayer = ({ detail }: { detail: MobileWatchDetail }) => {
    const player = useWatchPlayer(detail);
    const navigate = useNavigate();
    const pauseMenuOpen = player.paused && !player.videoError;

    return (
        <div className="view watch">
            <div className={`player${detail.isAudio ? ' audio' : ''}`}>
                {/* 字幕由页面自绘，不使用 WebVTT track，关闭 jsx-a11y 的 captions 规则。 */}
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                    ref={player.videoRef}
                    controls
                    playsInline
                    preload="metadata"
                    src={detail.streamUrl}
                    onLoadedMetadata={player.handleLoadedMetadata}
                    onTimeUpdate={player.handleTimeUpdate}
                    onSeeking={player.handleSeeking}
                    onSeeked={player.handleSeeked}
                    onPause={player.handlePause}
                    onPlay={player.handlePlay}
                    onEnded={player.handleEnded}
                    onError={player.handleError}
                    onLoadedData={player.handleLoadedData}
                />
                {player.videoError && (
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
                    line={player.currentLine}
                    translation={player.currentTranslation}
                    showEnglish={player.showEnglish}
                    showTranslation={player.showTranslation}
                    onWord={player.lookupWord}
                    onLongPress={player.openSettings}
                />
                <div
                    className={pauseMenuOpen ? 'subs menu-open' : 'subs'}
                    onTouchMove={player.handleUserScroll}
                    onWheel={player.handleUserScroll}
                >
                    {detail.subtitles.length === 0 ? (
                        <div className="subs-empty">
                            {t('这个视频没有匹配到字幕。', 'No subtitles matched this video.')}
                        </div>
                    ) : (
                        <Virtuoso
                            ref={player.virtuosoRef}
                            scrollerRef={player.handleScrollerRef}
                            style={{ height: '100%' }}
                            data={detail.subtitles}
                            computeItemKey={(index) => index}
                            defaultItemHeight={70}
                            increaseViewportBy={200}
                            minOverscanItemCount={{ top: 3, bottom: 6 }}
                            onScroll={player.handleScroll}
                            rangeChanged={player.handleRangeChanged}
                            itemContent={(index, line) => (
                                <SubtitleRow
                                    line={line}
                                    index={index}
                                    active={index === player.currentIndex}
                                    onSeek={player.seekLine}
                                />
                            )}
                        />
                    )}
                </div>
                {player.showFollow && (
                    <button type="button" className="follow-btn" onClick={player.followCurrent}>
                        {t('回到当前', 'Back to current')}
                    </button>
                )}
            </div>

            <div className="controls-wrap">
                <PlaybackControls
                    hasSubtitles={detail.subtitles.length > 0}
                    text={player.controlText}
                    onPrevious={() => player.stepLine(-1)}
                    onCurrent={player.replayCurrent}
                    onNext={() => player.stepLine(1)}
                />
                <PauseMenu
                    open={pauseMenuOpen}
                    onSettings={player.openSettings}
                    onHome={() => navigate('/', { replace: true })}
                />
            </div>

            <SettingsSheet
                open={player.settingsOpen}
                onClose={player.closeSettings}
                showEnglish={player.showEnglish}
                showTranslation={player.showTranslation}
                onToggleEnglish={player.toggleEnglish}
                onToggleTranslation={player.toggleTranslation}
                repeatOn={player.repeatOn}
                onToggleRepeat={player.toggleRepeat}
                autoPauseOn={player.autoPauseOn}
                onToggleAutoPause={player.toggleAutoPause}
                speed={player.speed}
                onChangeSpeed={player.changeSpeed}
                theme={player.theme}
                onChangeTheme={player.changeTheme}
            />

            <DictionaryBar ref={player.dictRef} dict={player.dict} />
        </div>
    );
};

/**
 * 手机版播放页：加载详情，成功后挂播放器。
 */
const WatchPage = () => {
    const { id } = useParams<{ id: string }>();
    const [detail, setDetail] = React.useState<MobileWatchDetail | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        let cancelled = false;
        setDetail(null);
        setError(null);
        if (!id) {
            setError(t('缺少视频标识', 'Missing video id'));
            return () => {
                cancelled = true;
            };
        }
        document.title = 'DashPlayer';
        mobileApi.getWatchDetail(id)
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
    }, [id]);

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

export default WatchPage;
