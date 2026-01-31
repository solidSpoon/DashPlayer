import { useCallback, useEffect, useRef } from 'react';
import { playerV2Actions } from '@/fronted/components/feature/player/player-v2';
import { usePlayerV2 } from '@/fronted/hooks/usePlayerV2';
import useFile from '@/fronted/hooks/useFile';
import StrUtil from '@/common/utils/str-util';
import UrlUtil from '@/common/utils/UrlUtil';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { computeResumeTime } from '@/fronted/lib/playerResume';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';

const api = backendClient;
const logger = getRendererLogger('usePlayerV2Bridge');

async function waitForPlayerDuration(timeoutMs = 1500): Promise<number> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const d = usePlayerV2.getState().duration;
        if (d > 0) return d;
        await new Promise((r) => setTimeout(r, 50));
    }
    return usePlayerV2.getState().duration;
}

export function usePlayerV2Bridge(navigate: (path: string) => void) {
    const videoPath = useFile((s) => s.videoPath);
    const subtitlePath = useFile((s) => s.subtitlePath);
    const videoId = useFile((s) => s.videoId);

    const lastLoadedFileRef = useRef<string | undefined>(undefined);

    useEffect(() => {
        lastLoadedFileRef.current = undefined;
    }, [videoPath]);

    useEffect(() => {
        if (StrUtil.isBlank(videoPath)) {
            playerV2Actions.setSource(null);
            return;
        }
        const fileUrl = UrlUtil.file(videoPath!);
        logger.debug('player source updated', { videoPath, fileUrl });
        playerV2Actions.setSource(fileUrl);
    }, [videoPath]);

    useEffect(() => {
        let cancelled = false;
        const loadSubtitles = async () => {
            if (StrUtil.isBlank(subtitlePath)) {
                useFile.setState({ srtHash: null });
                playerV2Actions.clearSubtitles();
                return;
            }
            const currentPath = subtitlePath!;
            useFile.setState({ srtHash: null });
            try {
                const result = await api.call('subtitle/srt/parse-to-sentences', currentPath);
                if (cancelled || currentPath !== useFile.getState().subtitlePath) {
                    return;
                }
                if (!result) {
                    useFile.setState({ subtitlePath: null });
                    playerV2Actions.clearSubtitles();
                    return;
                }
                playerV2Actions.loadSubtitles(result.sentences);
                useFile.setState({ srtHash: result.fileHash });
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
        const tick = async () => {
            if (stopped) return;
            try {
                if (useFile.getState().videoLoaded) {
                    const file = useFile.getState().videoPath;
                    if (StrUtil.isNotBlank(file)) {
                        counter += 1;
                        if (counter % 5 === 0) {
                            const playTime = usePlayerV2.getState().internal.exactPlayTime;
                            await api.call('watch-history/progress/update', {
                                file,
                                currentPosition: playTime
                            });
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
            logger.debug('handlePlayerReady skipped', { file, currentVideoId });
            return;
        }
        if (lastLoadedFileRef.current === file) {
            logger.debug('handlePlayerReady ignored (already loaded)', { file });
            return;
        }
        try {
            const result = await api.call('watch-history/detail', currentVideoId);
            const progress = result?.current_position ?? 0;
            const duration = await waitForPlayerDuration();
            const resumeTime = computeResumeTime({ progress, duration });
            logger.debug('jumping to history progress', { progress, duration, resumeTime, file, currentVideoId });

            if (resumeTime === 0 && progress > 0) {
                await api.call('watch-history/progress/update', { file, currentPosition: 0 });
            }

            playerV2Actions.seekTo({ time: resumeTime });
            playerV2Actions.play();
            lastLoadedFileRef.current = file;
        } catch (error) {
            logger.error('failed to jump to history progress', { error: error instanceof Error ? error.message : String(error) });
        }
        useFile.getState().loadedVideo(file);
    }, []);

    const handleAutoPlayNext = useCallback(async () => {
        const currentVideoId = useFile.getState().videoId;
        const autoPlayNext = usePlayerV2.getState().autoPlayNext;
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
