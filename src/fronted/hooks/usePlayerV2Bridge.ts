import { useCallback, useEffect, useRef } from 'react';
import { playerV2Actions } from '@/fronted/components/player-components';
import { usePlayerV2 } from '@/fronted/hooks/usePlayerV2';
import useFile from '@/fronted/hooks/useFile';
import StrUtil from '@/common/utils/str-util';
import UrlUtil from '@/common/utils/UrlUtil';
import { getRendererLogger } from '@/fronted/log/simple-logger';

const api = window.electron;
const logger = getRendererLogger('usePlayerV2Bridge');

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
            return;
        }
        if (lastLoadedFileRef.current === file) {
            return;
        }
        try {
            const result = await api.call('watch-history/detail', currentVideoId);
            const progress = result?.current_position ?? 0;
            logger.debug('jumping to history progress', { progress });
            playerV2Actions.seekTo({ time: progress });
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
