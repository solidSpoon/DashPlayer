/**
 * 负责把文件状态、字幕解析、播放历史和播放器 store 串起来。
 */
import { useCallback, useEffect, useRef } from 'react';
import { playerActions } from '@/fronted/features/player/components/PlayerActions';
import { usePlayer } from '@/fronted/features/player/playerStore';
import useFile from '@/fronted/features/file-browser/fileStore';
import StrUtil from '@/common/utils/str-util';
import UrlUtil from '@/common/utils/UrlUtil';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { computeResumeTime } from '@/fronted/lib/playerResume';
import { playerApi } from '@/fronted/features/player/playerApi';
import useTranslation from '@/fronted/features/player/translationStore';
import useVocabulary from '@/fronted/features/player/vocabularyStore';
import { transcriptApi } from '@/fronted/features/transcript/transcriptApi';
import { TRANSCRIPTION_CHUNK_SECONDS } from '@/common/contracts/transcript/transcript-task';

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
    const srtHash = useFile((s) => s.srtHash);
    const subtitleSessionId = useFile((s) => s.subtitleSessionId);
    const videoId = useFile((s) => s.videoId);
    /** 字幕重载令牌；增量转录会话结束后由 renderer api 递增，触发字幕回退重载。 */
    const subtitleReloadToken = useFile((s) => s.subtitleReloadToken);

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
            useVocabulary.getState().clearVocabularyWords();
            const currentVideoId = videoId;
            if (StrUtil.isBlank(currentVideoId)) {
                return;
            }
            // 先清掉上一视频残留的字幕哈希与翻译上下文，避免增量分支提前返回时旧状态继续生效。
            useFile.setState({
                srtHash: null,
                subtitleSessionId: null,
            });
            useTranslation.getState().setActiveFileHash(null);
            playerActions.clearSubtitles();
            const currentPath = StrUtil.isBlank(subtitlePath) ? null : subtitlePath!;
            const incrementalSnapshot = await transcriptApi.getSessionSnapshot(videoPath!);
            if (cancelled || videoPath !== useFile.getState().videoPath) return;
            if (incrementalSnapshot && incrementalSnapshot.sentences.length > 0) {
                // 转录进行中：增量字幕优先于已挂载的 SRT，直到会话结束。
                useTranslation.getState().setActiveFileHash(incrementalSnapshot.sessionId);
                playerActions.loadSubtitles(incrementalSnapshot.sentences);
                return;
            }
            const playbackSessionId = crypto.randomUUID();
            logger.info('subtitle parsing started', {
                videoId: currentVideoId,
                subtitlePath: currentPath,
                playbackSessionId,
            });
            try {
                const result = await playerApi.parseSubtitleToSentences({
                    subtitlePath: currentPath,
                    videoId: currentVideoId!,
                    playbackSessionId,
                });
                if (
                    cancelled
                    || currentPath !== useFile.getState().subtitlePath
                    || currentVideoId !== useFile.getState().videoId
                ) {
                    return;
                }
                if (!result) {
                    useFile.setState({ subtitlePath: null });
                    useTranslation.getState().setActiveFileHash(null);
                    playerActions.clearSubtitles();
                    return;
                }
                useFile.setState({
                    srtHash: result.fileHash,
                    subtitleSessionId: playbackSessionId,
                });
                useTranslation.getState().setActiveFileHash(result.fileHash);
                playerActions.loadSubtitles(result.sentences);
                logger.info('subtitle parsing completed', {
                    videoId: currentVideoId,
                    subtitlePath: currentPath,
                    fileHash: result.fileHash,
                    sentenceCount: result.sentences.length,
                    playbackSessionId,
                });
            } catch (error) {
                logger.error('failed to load subtitles', { error: error instanceof Error ? error.message : String(error) });
            }
        };

        loadSubtitles().then();
        return () => {
            cancelled = true;
        };
    }, [subtitlePath, videoId, videoPath, subtitleReloadToken]);

    useEffect(() => {
        if (StrUtil.isBlank(videoPath)) return;
        /**
         * 上报播放位置驱动后端调整待识别块优先级。
         *
         * 块的就近顺序只在相邻块起点的中点附近翻转，中点距半块（chunk/2）网格边界最多偏半秒
         * （来自 1 秒块重叠），因此按半块区间去重的代价是不超过 0.5 秒的需求延迟。
         * 效果：暂停时零上报，正常播放每分钟至多一次，快跳必然跨区间并立即上报。
         */
        const demandGranularity = TRANSCRIPTION_CHUNK_SECONDS / 2;
        /** 最近一次已上报位置所在的半块区间；-1 保证首次检查必定上报一次。 */
        let lastReportedBucket = -1;
        const reportDemand = () => {
            const position = usePlayer.getState().internal.exactPlayTime;
            const bucket = Math.floor(position / demandGranularity);
            if (bucket === lastReportedBucket) return;
            lastReportedBucket = bucket;
            void transcriptApi.updateDemand(videoPath!, position).catch((error) => {
                logger.warn('failed to update transcription demand', {
                    videoPath,
                    position,
                    error: error instanceof Error ? error.message : String(error),
                });
            });
        };
        const timer = window.setInterval(reportDemand, 2000);
        return () => window.clearInterval(timer);
    }, [videoPath]);

    useEffect(() => {
        let cancelled = false;

        /**
         * 在字幕已经交给播放器后，独立匹配当前字幕中出现的用户生词。
         *
         * 结果必须与当前字幕哈希一致，避免切换视频后旧任务覆盖新页面。
         */
        const loadVocabulary = async () => {
            if (
                StrUtil.isBlank(srtHash)
                || StrUtil.isBlank(subtitleSessionId)
                || StrUtil.isBlank(videoId)
            ) {
                return;
            }

            const currentFileHash = srtHash!;
            const currentSessionId = subtitleSessionId!;
            const currentVideoId = videoId!;
            try {
                const result = await playerApi.matchSubtitleVocabulary({
                    fileHash: currentFileHash,
                    videoId: currentVideoId,
                    playbackSessionId: currentSessionId,
                });
                if (
                    cancelled
                    || result.cancelled
                    || result.videoId !== currentVideoId
                    || result.playbackSessionId !== currentSessionId
                    || result.fileHash !== currentFileHash
                    || useFile.getState().srtHash !== currentFileHash
                    || useFile.getState().subtitleSessionId !== currentSessionId
                    || useFile.getState().videoId !== currentVideoId
                ) {
                    return;
                }
                useVocabulary.getState().setVocabularyWords(result.vocabularyWords);
            } catch (error) {
                logger.error('failed to match subtitle vocabulary', {
                    error: error instanceof Error ? error.message : String(error),
                    fileHash: currentFileHash,
                });
            }
        };

        loadVocabulary().then();
        return () => {
            cancelled = true;
        };
    }, [srtHash, subtitleSessionId, videoId]);

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
                                await playerApi.updateProgress({
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

    /**
     * PlayerEngine 的 onReady 回调（canplay 事件）：恢复播放进度并把视频标记为已加载。
     *
     * onReady 在每次 seek/缓冲完成后都会重放（训练模式连续 seek 时可达每秒数次），
     * 靠 lastLoadedFileRef 幂等去重；守卫命中是常规路径，只在 debug 级留下痕迹。
     */
    const handlePlayerReady = useCallback(async () => {
        const file = useFile.getState().videoPath;
        const currentVideoId = useFile.getState().videoId;
        logger.debug('player ready callback entered', {
            videoId: currentVideoId,
            videoPath: file,
            lastLoadedFile: lastLoadedFileRef.current,
            videoLoaded: useFile.getState().videoLoaded,
        });
        if (StrUtil.isBlank(file) || StrUtil.isBlank(currentVideoId)) {
            logger.warn('player ready callback skipped: missing file context', {
                videoId: currentVideoId,
                videoPath: file,
            });
            return;
        }
        if (lastLoadedFileRef.current === file) {
            return;
        }
        try {
            const result = await playerApi.getPlayerDetail(currentVideoId);
            const progress = result?.current_position ?? 0;
            const duration = await waitForPlayerDuration();
            const resumeTime = computeResumeTime({ progress, duration });
            logger.debug('jumping to history progress', { progress, duration, resumeTime });

            if (resumeTime === 0 && progress > 0) {
                await playerApi.updateProgress({ file, currentPosition: 0 });
            }

            playerActions.seekTo({ time: resumeTime });
            playerActions.play();
            lastLoadedFileRef.current = file;
        } catch (error) {
            logger.error('failed to jump to history progress', { error: error instanceof Error ? error.message : String(error) });
        }
        useFile.getState().loadedVideo(file);
        logger.info('player ready callback completed', {
            videoId: currentVideoId,
            videoPath: file,
            videoLoaded: useFile.getState().videoLoaded,
        });
    }, []);

    const handleAutoPlayNext = useCallback(async () => {
        const currentVideoId = useFile.getState().videoId;
        const autoPlayNext = usePlayer.getState().autoPlayNext;
        if (!autoPlayNext || !currentVideoId) {
            return;
        }
        try {
            const nextVideo = await playerApi.getNextVideo(currentVideoId);
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
