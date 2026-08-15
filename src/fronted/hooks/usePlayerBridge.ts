/**
 * 负责把文件状态、字幕解析、播放历史和播放器 store 串起来。
 */
import { useCallback, useEffect, useRef } from 'react';
import { playerActions } from '@/fronted/components/feature/player/player';
import { usePlayer } from '@/fronted/hooks/usePlayer';
import useFile from '@/fronted/hooks/useFile';
import StrUtil from '@/common/utils/str-util';
import UrlUtil from '@/common/utils/UrlUtil';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { computeResumeTime } from '@/fronted/lib/playerResume';
import { backendClient } from '@/fronted/infrastructure/electron/backendClient';
import useTranslation from '@/fronted/hooks/useTranslation';

const api = backendClient;
const logger = getRendererLogger('usePlayerBridge');

async function waitForPlayerDuration(timeoutMs = 1500): Promise<number> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const d = usePlayer.getState().duration;
        if (d > 0) return d;
        await new Promise((r) => setTimeout(r, 50));
    }
    return usePlayer.getState().duration;
}

/**
 * 绑定播放器所需的外部副作用，并返回页面层直接使用的桥接事件。
 */
export function usePlayerBridge(navigate: (path: string) => void) {
    const videoPath = useFile((s) => s.videoPath);
    const subtitlePath = useFile((s) => s.subtitlePath);
    const videoId = useFile((s) => s.videoId);

    const lastLoadedFileRef = useRef<string | undefined>(undefined);

    useEffect(() => {
        lastLoadedFileRef.current = undefined;
    }, [videoPath]);

    useEffect(() => {
        if (StrUtil.isBlank(videoPath)) {
            playerActions.setSource(null);
            return;
        }
        const fileUrl = UrlUtil.toUrl(videoPath!);
        playerActions.setSource(fileUrl);
    }, [videoPath]);

    useEffect(() => {
        let cancelled = false;
        /**
         * 按当前字幕路径重建前端字幕上下文。
         *
         * 行为说明：
         * - 切换字幕时先清空旧字幕与旧翻译上下文，避免旧句子继续触发懒加载副作用。
         * - 新字幕解析成功后，先激活新的 fileHash，再加载字幕，确保依赖当前句子的副作用看到的是一致上下文。
         */
        const loadSubtitles = async () => {
            if (StrUtil.isBlank(subtitlePath)) {
                useFile.setState({ srtHash: null });
                useTranslation.getState().setActiveFileHash(null);
                playerActions.clearSubtitles();
                return;
            }
            const currentPath = subtitlePath!;
            useFile.setState({ srtHash: null });
            useTranslation.getState().setActiveFileHash(null);
            playerActions.clearSubtitles();
            try {
                const result = await api.call('subtitle/srt/parse-to-sentences', currentPath);
                if (cancelled || currentPath !== useFile.getState().subtitlePath) {
                    return;
                }
                if (!result) {
                    useFile.setState({ subtitlePath: null });
                    useTranslation.getState().setActiveFileHash(null);
                    playerActions.clearSubtitles();
                    return;
                }
                useFile.setState({ srtHash: result.fileHash });
                useTranslation.getState().setActiveFileHash(result.fileHash);
                playerActions.loadSubtitles(result.sentences);
            } catch (error) {
                logger.error('failed to load subtitles', { error: error instanceof Error ? error.message : String(error) });
            }
        };

        loadSubtitles().then();
        return () => {
            cancelled = true;
        };
    }, [subtitlePath]);

    useEffect(() => {
        if (!videoId) return;
        let stopped = false;
        let counter = 0;
        // 上次上报的位置与播放状态；用于判断是否真的需要上报，避免暂停期间每 5 秒空刷日志。
        let lastReportedPosition = -1;
        let lastReportedPlaying: boolean | null = null;
        /**
         * 定时上报播放进度：仅当位置变化超过 1 秒或播放/暂停状态切换时才上报，
         * 正常播放保持每 5 秒一次的节奏，暂停/位置不变时零上报。
         */
        const tick = async () => {
            if (stopped) return;
            try {
                if (useFile.getState().videoLoaded) {
                    const file = useFile.getState().videoPath;
                    if (StrUtil.isNotBlank(file)) {
                        counter += 1;
                        if (counter % 5 === 0) {
                            const playTime = usePlayer.getState().internal.exactPlayTime;
                            const playing = usePlayer.getState().playing;
                            const positionMoved = Math.abs(playTime - lastReportedPosition) >= 1;
                            const stateChanged = playing !== lastReportedPlaying;
                            if (positionMoved || stateChanged) {
                                lastReportedPosition = playTime;
                                lastReportedPlaying = playing;
                                await api.call('watch-history/progress/update', {
                                    file,
                                    currentPosition: playTime
                                });
                            }
                        }
                    }
                }
            } catch (error) {
                logger.error('failed to update watch history progress', { error: error instanceof Error ? error.message : String(error) });
            } finally {
                setTimeout(tick, 1000);
            }
        };
        tick();
        return () => {
            stopped = true;
        };
    }, [videoId]);

    const handlePlayerReady = useCallback(async () => {
        const file = useFile.getState().videoPath;
        const currentVideoId = useFile.getState().videoId;
        if (StrUtil.isBlank(file) || StrUtil.isBlank(currentVideoId)) {
            return;
        }
        if (lastLoadedFileRef.current === file) {
            return;
        }
        try {
            const result = await api.call('watch-history/detail', currentVideoId);
            const progress = result?.current_position ?? 0;
            const duration = await waitForPlayerDuration();
            const resumeTime = computeResumeTime({ progress, duration });
            logger.debug('jumping to history progress', { progress, duration, resumeTime });

            if (resumeTime === 0 && progress > 0) {
                await api.call('watch-history/progress/update', { file, currentPosition: 0 });
            }

            playerActions.seekTo({ time: resumeTime });
            playerActions.play();
            lastLoadedFileRef.current = file;
        } catch (error) {
            logger.error('failed to jump to history progress', { error: error instanceof Error ? error.message : String(error) });
        }
        useFile.getState().loadedVideo(file);
    }, []);

    const handleAutoPlayNext = useCallback(async () => {
        const currentVideoId = useFile.getState().videoId;
        const autoPlayNext = usePlayer.getState().autoPlayNext;
        if (!autoPlayNext || !currentVideoId) {
            return;
        }
        try {
            const nextVideo = await api.call('watch-history/get-next-video', currentVideoId);
            if (nextVideo) {
                logger.info('auto playing next video', { fileName: nextVideo.fileName });
                navigate(`/player/${nextVideo.id}`);
            } else {
                logger.debug('no next video found');
            }
        } catch (error) {
            logger.error('failed to get next video', { error: error instanceof Error ? error.message : String(error) });
        }
    }, [navigate]);

    return {
        handlePlayerReady,
        handleAutoPlayNext
    };
}
