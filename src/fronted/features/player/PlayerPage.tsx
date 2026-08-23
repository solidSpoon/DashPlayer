import {AnimatePresence} from 'framer-motion';
import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {useLocation, useNavigate, useParams, useSearchParams} from 'react-router-dom';
import useLayout, {cpW} from '@/fronted/hooks/useLayout';
import {cn} from '@/fronted/lib/utils';
import FileBrowser from '@/fronted/features/file-browser/components/FileBrowser';
import ControlBox from '@/fronted/features/player/components/control-box/ControlBox';
import ControlButton from '@/fronted/features/player/components/ControlButton';
import useFile from '@/fronted/features/file-browser/fileStore';
import PlayerShortcut from '@/fronted/features/player/components/PlayerShortcut';
import SideBar from '@/fronted/components/layout/SideBar';
import ChatPanel from '@/fronted/features/chat/ChatPanel';
import useChatPanel from '@/fronted/features/chat/chatStore';
import useSWR from 'swr';
import PlaybackLayout from '@/fronted/features/player/components/srt-layout/Layout';
import {SWR_KEY, swrMutate} from '@/fronted/lib/swr-util';
import PathUtil from '@/common/utils/PathUtil';
import MediaUtil from '@/common/utils/MediaUtil';
import {getRendererLogger} from '@/fronted/log/simple-logger';
import toast, { Toast } from 'react-hot-toast';
import {ModeSwitchToast} from '@/fronted/components/shared/toasts/ModeSwitchToast';
import useSystem from '@/fronted/hooks/useSystem';
import useConvert from '@/fronted/features/convert/convertStore';
import { toast as sonnerToast } from 'sonner';
import { playerApi } from '@/fronted/features/player/playerApi';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import useSubtitleTranslation from '@/fronted/features/player/translationStore';
import { playerActions } from '@/fronted/features/player/components/PlayerActions';

const logger = getRendererLogger('PlayerWithControlsPage');
const MODE_SWITCH_TOAST_ID = 'mode-switch-toast';
const COMPAT_TOAST_ID = 'compat-playback-toast';
const PlayerWithControlsPage = () => {
    const { t } = useI18nTranslation('player');
    const {videoId} = useParams();
    const navigate = useNavigate();
    const {data: video} = useSWR([SWR_KEY.PLAYER_P, videoId], ([_key, videoId]) => playerApi.getPlayerDetail(videoId));
    logger.debug('pa-player page loaded', {videoId, hasVideo: !!video});
    const { data: windowState } = useSWR(SWR_KEY.WINDOW_SIZE, playerApi.getWindowState);
    const isMac = useSystem((s) => s.isMac);
    const showSideBar = useLayout((state) => state.showSideBar);
    const titleBarHeight = useLayout((state) => state.titleBarHeight);
    const uiFullScreen = useLayout((s) => s.fullScreen);
    const chatTopic = useChatPanel(s => s.topic);
    const videoLoaded = useFile((s) => s.videoLoaded);
    const w = cpW.bind(
        null,
        useLayout((s) => s.width)
    );
    const h = cpW.bind(
        null,
        useLayout((s) => s.height)
    );
    const location = useLocation();
    const [_searchParams, setSearchParams] = useSearchParams();
    const referrer = location.state && location.state.referrer;
    logger.debug('page referrer', {referrer});
    const windowButtonsVisibleRef = useRef<boolean | null>(null);
    const compatToastShownRef = useRef<Set<string>>(new Set());
    useEffect(() => {
        if (!isMac) {
            return;
        }

        const isVideo = !!video && !MediaUtil.isAudio(video.fileName);
        if (!isVideo) {
            playerApi.setWindowButtonsVisibility(true).then();
            windowButtonsVisibleRef.current = true;
            return;
        }

        const setVisible = (visible: boolean) => {
            if (windowButtonsVisibleRef.current === visible) {
                return;
            }
            windowButtonsVisibleRef.current = visible;
            playerApi.setWindowButtonsVisibility(visible).then();
        };

        if (showSideBar) {
            setVisible(true);
            return;
        }

        const HOT_ZONE_WIDTH_PX = 480;
        const HOT_ZONE_HEIGHT_PX = 160;
        const HIDE_DELAY_MS = 250;

        let hideTimeout: NodeJS.Timeout | null = null;
        const scheduleHide = () => {
            if (hideTimeout) {
                clearTimeout(hideTimeout);
            }
            hideTimeout = setTimeout(() => setVisible(false), HIDE_DELAY_MS);
        };

        const onMouseMove = (e: MouseEvent) => {
            const nearTrafficLights = e.clientX <= HOT_ZONE_WIDTH_PX && e.clientY <= HOT_ZONE_HEIGHT_PX;
            if (nearTrafficLights) {
                if (hideTimeout) {
                    clearTimeout(hideTimeout);
                    hideTimeout = null;
                }
                setVisible(true);
            } else {
                scheduleHide();
            }
        };

        setVisible(false);
        window.addEventListener('mousemove', onMouseMove);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            if (hideTimeout) {
                clearTimeout(hideTimeout);
            }
            setVisible(true);
        };
    }, [chatTopic, isMac, showSideBar, uiFullScreen, video, windowState]);
    useEffect(() => {
        /**
         * 应用轻量播放详情，并优先把视频源写入播放器状态。
         */
        const runEffect = () => {
            logger.debug('video effect triggered', {video});
            if (!video) {
                // 菜单页与播放器共用同一页面实例，离开播放器时必须清理旧媒体上下文，
                // 否则返回同一个视频时路径和 videoId 不变，播放器不会重新触发 ready。
                useFile.getState().clear();
                useSubtitleTranslation.getState().clearTranslations();
                playerActions.clearSubtitles();
                playerActions.setSource(null);
                return;
            }
            const previousVideoId = useFile.getState().videoId;
            useFile.setState({videoId: video.id});
            const vp = useFile.getState().videoPath;
            const videoPath = PathUtil.join(video.basePath, video.fileName);
            if (previousVideoId !== video.id) {
                useFile.setState({
                    subtitlePath: null,
                    srtHash: null,
                    subtitleSessionId: null,
                });
            }
            if (videoPath && vp !== videoPath) {
                useFile.getState().updateFile(videoPath);
            }

            setTimeout(() => {
                (async () => {
                    if (!videoPath || compatToastShownRef.current.has(videoPath)) {
                        return;
                    }
                    compatToastShownRef.current.add(videoPath);
                    try {
                        const suggested = await playerApi.suggestHtml5Video(videoPath);
                        if (suggested) {
                            return;
                        }
                        const info = await playerApi.getMediaInfo(videoPath);
                        const audioCodec = (info?.audioCodec ?? '').toLowerCase();
                        const suspiciousAudioCodecs = new Set([
                            'dts',
                            'dca',
                            'truehd',
                            'mlp',
                            'eac3',
                            'ac3',
                            'opus',
                            'vorbis',
                        ]);
                        if (audioCodec.length > 0 && !suspiciousAudioCodecs.has(audioCodec)) {
                            return;
                        }
                        sonnerToast(t('compatToastTitle'), {
                            id: COMPAT_TOAST_ID,
                            duration: 6000,
                            position: 'top-right',
                            action: {
                                label: t('compatToastAction'),
                                onClick: () => {
                                    useConvert.getState().addFiles([videoPath]);
                                    navigate('/convert');
                                },
                            },
                        });
                    } catch (error) {
                        logger.debug('compat probe failed', { error: error instanceof Error ? error.message : String(error) });
                    }
                })().then();
            }, 800);

            if (video) {
                const mediaType: 'audio' | 'video' = MediaUtil.isAudio(video.fileName) ? 'audio' : 'video';
                if (video.podcastModeUserSet) {
                    // 用户手动选择过：直接应用选择，不再自动切换
                    useLayout.getState().setPodcastMode(video.podcastModeManual ?? false);
                } else {
                    // 没有用户偏好：首次打开音频自动进播客模式，视频自动回普通模式
                    if (mediaType === 'audio') {
                        const currentMode = useLayout.getState().podcastMode;
                        if (!currentMode) {
                            useLayout.getState().setPodcastMode(true);
                            toast(
                                (t: Toast) => (
                                    <ModeSwitchToast
                                        mode="podcast"
                                        onCancel={() => {
                                            useLayout.getState().setPodcastMode(false);
                                            void playerApi.setPodcastModePreference(video.id, false);
                                            void swrMutate(SWR_KEY.PLAYER_P);
                                            toast.dismiss(t.id);
                                        }}
                                    />
                                ),
                                {
                                    id: MODE_SWITCH_TOAST_ID,
                                    duration: 5000,
                                }
                            );
                        }
                    } else {
                        const currentMode = useLayout.getState().podcastMode;
                        if (currentMode) {
                            useLayout.getState().setPodcastMode(false);
                            toast(
                                (t: Toast) => (
                                    <ModeSwitchToast
                                        mode="video"
                                        onCancel={() => {
                                            useLayout.getState().setPodcastMode(true);
                                            void playerApi.setPodcastModePreference(video.id, true);
                                            void swrMutate(SWR_KEY.PLAYER_P);
                                            toast.dismiss(t.id);
                                        }}
                                    />
                                ),
                                {
                                    id: MODE_SWITCH_TOAST_ID,
                                    duration: 5000,
                                }
                            );
                        }
                    }
                }
            }
        };
        runEffect();
    }, [video, navigate, t]);
    useEffect(() => {
        let cancelled = false;

        /**
         * 在当前视频完成 ready、恢复进度并发出播放指令后，再匹配和解析字幕。
         *
         * 同时校验 store 中的实时状态，避免切换视频时沿用上一条记录的
         * `videoLoaded` 快照，导致新视频尚未 ready 就开始解析字幕。
         */
        const loadSubtitleAfterVideoReady = async () => {
            if (!video || !videoLoaded) {
                return;
            }

            const videoPath = PathUtil.join(video.basePath, video.fileName);
            const fileState = useFile.getState();
            if (
                !fileState.videoLoaded
                || fileState.videoId !== video.id
                || fileState.videoPath !== videoPath
            ) {
                return;
            }

            try {
                const subtitlePath = await playerApi.getPlayerSubtitle(video.id);
                const latestFileState = useFile.getState();
                if (
                    cancelled
                    || !latestFileState.videoLoaded
                    || latestFileState.videoId !== video.id
                    || latestFileState.videoPath !== videoPath
                ) {
                    return;
                }
                if (subtitlePath) {
                    logger.info('player subtitle resolved', {
                        videoId: video.id,
                        subtitlePath,
                        videoPath,
                    });
                    latestFileState.updateFile(subtitlePath);
                } else {
                    logger.info('player subtitle not found', {
                        videoId: video.id,
                        videoPath,
                    });
                    latestFileState.clearSrt();
                }
            } catch (error) {
                logger.error('failed to resolve player subtitle', {
                    error: error instanceof Error ? error.message : String(error),
                    videoId: video.id,
                });
            }
        };
        loadSubtitleAfterVideoReady().then();
        return () => {
            cancelled = true;
        };
    }, [video, videoLoaded]);
    useEffect(() => {
        setSearchParams({sideBarAnimation: 'true'});
    }, [setSearchParams]);
    const posRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({x: 0, y: 0, scale: 1});
    useLayoutEffect(() => {
        const updatePos = () => {
            if (posRef.current === null) {
                return;
            }
            const rect = posRef.current.getBoundingClientRect();
            setPos({
                x: rect.x,
                y:
                    rect.y -
                    titleBarHeight +
                    (window.innerHeight - titleBarHeight) * 0.05,
                scale: rect.width / window.innerWidth
            });
        };
        updatePos();
        window.addEventListener('resize', updatePos);
        return () => {
            window.removeEventListener('resize', updatePos);
        };
    }, [titleBarHeight]);

    const showPlayer = w('md') && h('md');
    const gridTemplate = () => {
        if (showPlayer && w('xl')) {
            return '15% 60% 25%';
        }
        if (showPlayer) {
            return '65px calc((100% - 65px) * 12 / 17) calc((100% - 65px) * 5 / 17)';
        }
        if (!showPlayer && w('xl')) {
            return '15% 42.5% 42.5%';
        }
        return '65px calc((100% - 65px) * 1 / 2) calc((100% - 65px) * 1 / 2)';
    };
    return (
        <div className={cn('relative w-full h-full ')}>
            <div
                className="absolute inset-0 grid grid-cols-3 grid-rows-2 overflow-hidden"
                style={{
                    gridTemplateColumns: gridTemplate(),
                    gridTemplateRows: '30% 70%' // 这里定义每行的大小
                }}
            >
                {showSideBar && (
                    <>
                        <div
                            className={cn(
                                'col-start-1 col-end-2 row-start-1 row-end-3'
                            )}
                        >
                            <SideBar compact={!w('xl')}/>
                        </div>
                        <div
                            className={cn(
                                'col-start-2 row-start-1 col-end-4 row-end-3 p-2',
                                h('md') && 'row-start-2',
                                w('md') && 'row-start-1 col-start-3 pl-1'
                            )}
                        >
                            <FileBrowser/>
                        </div>

                        <div
                            className={cn(
                                'hidden row-start-1 row-end-3 col-start-2  col-end-4 p-2',
                                w('md') && 'block col-end-3',
                                h('md') && 'block row-end-2'
                            )}
                        >
                            <ControlBox/>
                        </div>
                    </>
                )}
                <div
                    className="p-4"
                    style={{
                        gridArea: '2 / 2 / 2 / 3'
                    }}
                >
                    <div className="w-full h-full" ref={posRef}/>
                </div>
                <div
                    className={cn(
                        'flex flex-col h-full w-full',
                        showSideBar ? 'p-4 pt-2 pr-2' : 'p-2.5',
                        !((w('md') && h('md')) || !showSideBar) && 'hidden'
                    )}
                    style={{
                        gridArea: '1 / 1 / -1 / -1',
                        transform: showSideBar
                            ? `translate(${pos.x}px, ${pos.y}px) scale(${pos.scale})`
                            : 'translate(0px, 0px) scale(1)',
                        transformOrigin: 'top left'
                    }}
                >
                    <PlaybackLayout/>
                </div>
                {chatTopic === 'offscreen' && (
                    <>
                        <ControlButton/>
                        <PlayerShortcut/>
                    </>
                )}
                <AnimatePresence>
                    {chatTopic !== 'offscreen' && <ChatPanel/>}
                </AnimatePresence>

            </div>
        </div>
    )
        ;
};

export default PlayerWithControlsPage;
