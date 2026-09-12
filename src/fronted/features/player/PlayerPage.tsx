import {AnimatePresence} from 'framer-motion';
import React, {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
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
import {
    PlaybackRepairToast,
    RepairToastVariant,
} from '@/fronted/components/shared/toasts/PlaybackRepairToast';
import { SubtitleSuspicionToast } from '@/fronted/components/shared/toasts/SubtitleSuspicionToast';
import { useSubtitleSuspicion } from '@/fronted/features/player/subtitleSuspicion';
import { startTranscriptionForCurrentVideo } from '@/fronted/features/player/startTranscription';
import useSystem from '@/fronted/hooks/useSystem';
import { playerApi } from '@/fronted/features/player/playerApi';
import { diagnosePlayback, probeAndRecordPlaybackCapability, repairPlayback } from '@/fronted/features/player/repairPlayback';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import useSubtitleTranslation from '@/fronted/features/player/translationStore';
import { playerActions } from '@/fronted/features/player/components/PlayerActions';
import { usePlayer } from '@/fronted/features/player/playerStore';
import {Button} from "@/fronted/components/ui/button";

const logger = getRendererLogger('PlayerWithControlsPage');
const MODE_SWITCH_TOAST_ID = 'mode-switch-toast';
const PLAYBACK_ISSUE_TOAST_ID = 'playback-issue-toast';
const SUBTITLE_SUSPICION_TOAST_ID = 'subtitle-suspicion-toast';

/**
 * 生成播放修复提示的 toast ID：同一条提示只允许存在一个，不同场景互不覆盖。
 *
 * @param variant 触发场景。
 * @returns toast ID。
 */
function playbackRepairToastId(variant: RepairToastVariant): string {
    return `playback-repair-toast-${variant}`;
}
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
    // 播放问题提示去重：同一文件同一场景只提示一次
    const repairToastShownRef = useRef<Set<string>>(new Set());
    // 字幕引导提示去重：同一视频本次页面会话内只提示一次
    const subtitleToastShownRef = useRef<Set<string>>(new Set());
    // 音频兼容预检去重：会话内每个文件只探测一次
    const audioProbeDoneRef = useRef<Set<string>>(new Set());
    // 卡死提示的"暂时忽略"：记录被忽略的视频 id，本次运行内该视频不再提示（不持久化）
    const stallIgnoreVideoIdRef = useRef<string | null>(null);
    const mediaErrorCode = usePlayer((s) => s.mediaErrorCode);
    const playbackStallCount = usePlayer((s) => s.playbackStallCount);
    /**
     * 弹出播放问题提示（按「文件 + 场景」去重），按钮直接启动一键修复。
     * @param videoPath 媒体绝对路径
     * @param variant 触发场景，决定提示文案
     */
    const showRepairToast = useCallback((videoPath: string, variant: RepairToastVariant) => {
        const dedupeKey = `${videoPath}::${variant}`;
        if (repairToastShownRef.current.has(dedupeKey)) {
            return;
        }
        repairToastShownRef.current.add(dedupeKey);
        toast(
            (tState: Toast) => (
                <PlaybackRepairToast
                    variant={variant}
                    onRepair={() => {
                        toast.dismiss(tState.id);
                        void repairPlayback(videoPath);
                    }}
                    onIgnore={() => {
                        toast.dismiss(tState.id);
                    }}
                />
            ),
            {
                id: playbackRepairToastId(variant),
                duration: 10000,
            }
        );
    }, []);
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
                useSubtitleSuspicion.getState().setReasons([]);
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
                // 换视频后旧字幕的可疑结论不再成立，等 player-subtitle 重新解析
                useSubtitleSuspicion.getState().setReasons([]);
            }
            if (videoPath && vp !== videoPath) {
                useFile.getState().updateFile(videoPath);
            }

            // 播放兼容预检：容器/编码层面能提前看出来的问题，等播放报错就太晚了
            setTimeout(() => {
                (async () => {
                    if (!videoPath || audioProbeDoneRef.current.has(videoPath)) {
                        return;
                    }
                    // 先登记再探测，保证会话内每个文件只探测一次
                    audioProbeDoneRef.current.add(videoPath);
                    try {
                        const diagnosis = await diagnosePlayback(videoPath);
                        if (!diagnosis.needsRepair) {
                            // 白名单认为可直接播放：对从未实测过的编码做一次静默探测；
                            // 实测解不出时学习该结论并直接给出修复提示，避免「无需修复 → 播放黑屏」死胡同。
                            const learnedReason = await probeAndRecordPlaybackCapability(diagnosis);
                            if (learnedReason) {
                                showRepairToast(videoPath, learnedReason);
                            }
                            return;
                        }
                        showRepairToast(videoPath, diagnosis.reason);
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
    }, [video, showRepairToast]);
    useEffect(() => {
        // 卡死提示 / 播放错误提示：媒体报错或看门狗判定卡死触发
        if (mediaErrorCode === null && playbackStallCount === 0) {
            return;
        }
        const { videoId, videoPath } = useFile.getState();
        if (!videoId || !videoPath) {
            return;
        }
        if (stallIgnoreVideoIdRef.current === videoId) {
            return;
        }

        toast(
            (tState: Toast) => (
                <PlaybackRepairToast
                    variant="stall"
                    onRepair={() => {
                        toast.dismiss(tState.id);
                        void repairPlayback(videoPath);
                    }}
                    onIgnore={() => {
                        stallIgnoreVideoIdRef.current = videoId;
                        toast.dismiss(tState.id);
                    }}
                />
            ),
            {
                id: PLAYBACK_ISSUE_TOAST_ID,
                duration: 8000,
            }
        );
    }, [mediaErrorCode, playbackStallCount]);
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
                const resolution = await playerApi.getPlayerSubtitle(video.id);
                const latestFileState = useFile.getState();
                if (
                    cancelled
                    || !latestFileState.videoLoaded
                    || latestFileState.videoId !== video.id
                    || latestFileState.videoPath !== videoPath
                ) {
                    return;
                }
                if (resolution.subtitlePath) {
                    logger.info('player subtitle resolved', {
                        videoId: video.id,
                        subtitlePath: resolution.subtitlePath,
                        videoPath,
                        mismatchSuspected: resolution.mismatchSuspected,
                    });
                    // 先写可疑结论再更新字幕路径，保证字幕解析副作用读到一致的初始结论
                    useSubtitleSuspicion.getState().setReasons(resolution.mismatchSuspected ? ['name-mismatch'] : []);
                    latestFileState.updateFile(resolution.subtitlePath);
                } else {
                    logger.info('player subtitle not found', {
                        videoId: video.id,
                        videoPath,
                    });
                    useSubtitleSuspicion.getState().setReasons(['no-subtitle']);
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
    const subtitleSuspicions = useSubtitleSuspicion((s) => s.reasons);
    useEffect(() => {
        if (!video || !videoLoaded || subtitleSuspicions.length === 0) {
            return;
        }
        const videoKey = video.id;
        if (subtitleToastShownRef.current.has(videoKey)) {
            return;
        }
        // 延迟触发：等字幕解析合并 chinese-only 结论，并避开增量转录会话清除可疑的竞态。
        // 期间原因集合变化会重启定时器，触发时再读取最新结论。
        const timer = window.setTimeout(() => {
            const reasons = useSubtitleSuspicion.getState().reasons;
            if (subtitleToastShownRef.current.has(videoKey) || reasons.length === 0) {
                return;
            }
            subtitleToastShownRef.current.add(videoKey);
            toast(
                (tState: Toast) => (
                    <SubtitleSuspicionToast
                        reasons={reasons}
                        onGenerate={() => {
                            toast.dismiss(tState.id);
                            void startTranscriptionForCurrentVideo();
                        }}
                        onIgnore={() => {
                            toast.dismiss(tState.id);
                            useSubtitleSuspicion.getState().setReasons([]);
                        }}
                    />
                ),
                {
                    id: SUBTITLE_SUSPICION_TOAST_ID,
                    duration: 10000,
                }
            );
        }, 1200);
        return () => {
            window.clearTimeout(timer);
        };
    }, [video, videoLoaded, subtitleSuspicions]);
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
                                'col-start-2 row-start-1 col-end-4 row-end-3 p-2.5 pl-1.5',
                                h('md') && 'row-start-2',
                                w('md') && 'row-start-1 col-start-3 pl-1'
                            )}
                        >
                            <FileBrowser/>
                        </div>

                        <div
                            className={cn(
                                'hidden row-start-1 row-end-3 col-start-2 col-end-4 p-2.5 pl-1.5 pr-1',
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
                        'flex flex-col',
                        showSideBar && 'p-4 pt-2 pr-2',
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
