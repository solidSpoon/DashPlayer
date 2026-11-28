import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
    Download,
    FolderOpen,
    Loader2,
    Mic,
    MoreHorizontal,
    Pause,
    Play,
    RotateCcw,
    Square,
    Trash2,
    Volume2,
} from 'lucide-react';

import type { DubbingLibraryEntry, DubbingManifest, DubbingSentenceRecord } from '@/common/contracts/dubbing';
import type { Sentence } from '@/common/types/SentenceC';
import UrlUtil from '@/common/utils/UrlUtil';
import { dubbingApi } from '@/fronted/features/player/dubbing/dubbingApi';
import PlayerEngine from '@/fronted/features/player/components/PlayerEngine';
import { playerActions } from '@/fronted/features/player/components/PlayerActions';
import { usePlayerState } from '@/fronted/features/player/playerState';
import VideoPlayerShortcut from '@/fronted/features/video-learning/components/VideoPlayerShortcut';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { AspectRatio } from '@/fronted/components/ui/aspect-ratio';
import { Button } from '@/fronted/components/ui/button';
import { Progress } from '@/fronted/components/ui/progress';
import { cn } from '@/fronted/lib/utils';

const logger = getRendererLogger('DubbingPreviewPane');

/**
 * 单条视频的导出任务状态。
 */
export type VideoExportState =
    | { stage: 'running'; progress: number }
    | { stage: 'done'; outputPath: string }
    | { stage: 'failed'; message: string };

type ContextListItem =
    | { type: 'sentence'; sentence: Sentence; isDubbed: boolean }
    | { type: 'gap'; id: string; omittedCount: number };

interface DubbingPreviewPaneProps {
    /** 当前选中的配音视频条目。 */
    entry: DubbingLibraryEntry;
    /** 当前视频的导出状态（若发起过导出）。 */
    exportState?: VideoExportState;
    /** 全局是否正在执行导出任务（同一时间只允许一个）。 */
    exporting: boolean;
    /** 触发导出当前视频。 */
    onExport: () => void;
    /** 触发清除当前视频全部配音。 */
    onClearVideo: () => void;
    /** 删除单句录音后通知父组件刷新视频列表计数。 */
    onSentenceCleared: () => Promise<void>;
}

/**
 * 计算录音相对于字幕句长的加速倍率与超出秒数（与导出端 atempo 对齐）。
 */
const getSpeedInfo = (
    takeDurationSec: number,
    sentence?: Sentence | null,
): { speedFactor: number; overSec: number } => {
    if (!sentence) {
        return { speedFactor: 1, overSec: 0 };
    }
    const slotDuration = (sentence.adjustedEnd ?? sentence.end) - (sentence.adjustedStart ?? sentence.start);
    if (slotDuration <= 0 || takeDurationSec <= slotDuration) {
        return { speedFactor: 1, overSec: 0 };
    }
    return {
        speedFactor: takeDurationSec / slotDuration,
        overSec: takeDurationSec - slotDuration,
    };
};

/**
 * 将完整字幕按「已配音句及其前后各 1 句上下文」折叠为精简列表，中间未录制片段合并为省略标记。
 */
function buildContextItems(
    sentences: Sentence[],
    dubbedIndices: Set<number>,
): ContextListItem[] {
    if (sentences.length === 0) {
        return [];
    }

    const included = new Array<boolean>(sentences.length).fill(false);
    for (let i = 0; i < sentences.length; i++) {
        if (dubbedIndices.has(sentences[i].index)) {
            if (i > 0) included[i - 1] = true;
            included[i] = true;
            if (i + 1 < sentences.length) included[i + 1] = true;
        }
    }

    const items: ContextListItem[] = [];
    let i = 0;
    while (i < sentences.length) {
        if (included[i]) {
            const sentence = sentences[i];
            items.push({ type: 'sentence', sentence, isDubbed: dubbedIndices.has(sentence.index) });
            i++;
            continue;
        }
        const startPos = i;
        while (i < sentences.length && !included[i]) {
            i++;
        }
        const endPos = i - 1;
        items.push({
            type: 'gap',
            id: `${startPos}-${endPos}`,
            omittedCount: endPos - startPos + 1,
        });
    }
    return items;
}

/**
 * 配音导出页右侧预览区：精简视频播放器 + 右上角导出操作 + 上下文折叠配音列表。
 *
 * 播放视频时，已配音的句子会自动静音原声并播放用户录音，未配音句子恢复原声。
 */
export default function DubbingPreviewPane({
    entry,
    exportState,
    exporting,
    onExport,
    onClearVideo,
    onSentenceCleared,
}: DubbingPreviewPaneProps) {
    const { t } = useTranslation('pages');

    const playing = usePlayerState((s) => s.playing);
    const currentSentence = usePlayerState((s) => s.currentSentence);
    const autoPause = usePlayerState((s) => s.autoPause);
    const singleRepeat = usePlayerState((s) => s.singleRepeat);

    const [manifest, setManifest] = useState<DubbingManifest | null>(null);
    const [sentences, setSentences] = useState<Sentence[]>([]);
    const [loadingDetail, setLoadingDetail] = useState(true);
    const [subtitleError, setSubtitleError] = useState<string | null>(null);
    const [playerReady, setPlayerReady] = useState(false);
    const [playingTakeIndex, setPlayingTakeIndex] = useState<number | null>(null);
    const [clearingIndex, setClearingIndex] = useState<number | null>(null);
    const [replayTick, setReplayTick] = useState(0);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const videoElRef = useRef<HTMLVideoElement | null>(null);
    const activeDubbedSentenceRef = useRef<number | null>(null);

    const stopTakeAudio = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.onended = null;
            audioRef.current.pause();
            audioRef.current = null;
        }
        setPlayingTakeIndex(null);
    }, []);

    // 挂载时初始化播放器源并拉取配音清单与字幕列表（组件通过 key={entry.videoKey} 在切换视频时重建）
    useEffect(() => {
        let cancelled = false;
        playerActions.pause();
        playerActions.setSource(UrlUtil.toUrl(entry.videoPath));
        playerActions.clearSubtitles();

        const loadDetail = async () => {
            try {
                const result = await dubbingApi.preview(entry.videoKey);
                if (cancelled) {
                    return;
                }
                setManifest(result.manifest);

                if (result.subtitleStatus === 'missing-path') {
                    setSubtitleError(t('dubbingExport.preview.noSubtitle'));
                    return;
                }
                if (result.subtitleStatus === 'missing-file') {
                    setSubtitleError(t('dubbingExport.preview.subtitleLoadFailed'));
                    return;
                }
                setSentences(result.sentences);
                playerActions.loadSubtitles(result.sentences);
            } catch (error) {
                if (cancelled) {
                    return;
                }
                logger.error('加载配音详情失败', { videoKey: entry.videoKey, error });
                setSubtitleError(t('dubbingExport.preview.subtitleLoadFailed'));
            } finally {
                if (!cancelled) {
                    setLoadingDetail(false);
                }
            }
        };

        void loadDetail();

        return () => {
            cancelled = true;
            if (audioRef.current) {
                audioRef.current.onended = null;
                audioRef.current.pause();
                audioRef.current = null;
            }
            if (videoElRef.current) {
                videoElRef.current.muted = false;
            }
            activeDubbedSentenceRef.current = null;
            playerActions.pause();
            playerActions.clearSubtitles();
            playerActions.setSource(null);
        };
    }, [entry.videoKey, entry.videoPath, t]);

    const handlePlayerReady = useCallback(() => {
        setPlayerReady(true);
    }, []);

    const handleProvideVideoElement = useCallback((video: HTMLVideoElement | null) => {
        videoElRef.current = video;
    }, []);

    // 视频播放时自动将已配音句子替换为用户的录音（原声静音 + 播放录音），未配音句子恢复原声
    useEffect(() => {
        const videoEl = videoElRef.current;
        if (!playing || !currentSentence) {
            activeDubbedSentenceRef.current = null;
            if (videoEl) {
                videoEl.muted = false;
            }
            if (audioRef.current && playingTakeIndex === null) {
                audioRef.current.onended = null;
                audioRef.current.pause();
                audioRef.current = null;
            }
            return;
        }

        const record = manifest?.sentences[String(currentSentence.index)];
        if (!record?.take.filePath) {
            activeDubbedSentenceRef.current = null;
            if (videoEl) {
                videoEl.muted = false;
            }
            if (audioRef.current) {
                audioRef.current.onended = null;
                audioRef.current.pause();
                audioRef.current = null;
            }
            return;
        }

        if (videoEl) {
            videoEl.muted = true;
        }

        if (activeDubbedSentenceRef.current === currentSentence.index) {
            return;
        }
        activeDubbedSentenceRef.current = currentSentence.index;

        if (audioRef.current) {
            audioRef.current.onended = null;
            audioRef.current.pause();
            audioRef.current = null;
        }

        const audio = new Audio(UrlUtil.toUrl(record.take.filePath));
        audio.volume = 0.9;
        audio.playbackRate = getSpeedInfo(record.take.durationSec, currentSentence).speedFactor;
        audio.onended = () => {
            if (audioRef.current === audio) {
                audioRef.current = null;
            }
        };
        audioRef.current = audio;
        void audio.play().catch((error) => {
            logger.error('播放配音替换音轨失败', { sentenceIndex: currentSentence.index, error });
            if (audioRef.current === audio) {
                audioRef.current = null;
            }
        });
    }, [playing, currentSentence, manifest, replayTick, playingTakeIndex]);

    const dubbedRecords = useMemo<DubbingSentenceRecord[]>(() => {
        if (!manifest) {
            return [];
        }
        return Object.values(manifest.sentences).sort((a, b) => a.index - b.index);
    }, [manifest]);

    const dubbedIndices = useMemo(
        () => new Set(dubbedRecords.map((record) => record.index)),
        [dubbedRecords],
    );

    const contextItems = useMemo(
        () => buildContextItems(sentences, dubbedIndices),
        [sentences, dubbedIndices],
    );

    const visibleSentences = useMemo(
        () => contextItems.filter((item): item is Extract<ContextListItem, { type: 'sentence' }> => item.type === 'sentence').map((item) => item.sentence),
        [contextItems],
    );

    const visibleSentenceIndexSet = useMemo(
        () => new Set(visibleSentences.map((s) => s.index)),
        [visibleSentences],
    );

    const handleSeekToSentence = useCallback((sentence: Sentence) => {
        stopTakeAudio();
        activeDubbedSentenceRef.current = null;
        setReplayTick((prev) => prev + 1);
        playerActions.seekToTarget({
            time: sentence.adjustedStart ?? sentence.start,
            target: sentence,
            play: true,
        });
    }, [stopTakeAudio]);

    // 播放进入被省略区间时自动跳到下一段可见字幕；全部可见段播完则自动暂停
    useEffect(() => {
        if (!playing || !currentSentence || visibleSentences.length === 0) {
            return;
        }
        if (visibleSentenceIndexSet.has(currentSentence.index)) {
            return;
        }
        const nextVisible = visibleSentences.find((s) => s.index > currentSentence.index);
        if (nextVisible) {
            activeDubbedSentenceRef.current = null;
            playerActions.seekToTarget({
                time: nextVisible.adjustedStart ?? nextVisible.start,
                target: nextVisible,
                play: true,
            });
        } else {
            playerActions.pause();
        }
    }, [playing, currentSentence, visibleSentences, visibleSentenceIndexSet]);

    const handleToggleVideoPlay = useCallback(() => {
        if (!playing) {
            stopTakeAudio();
            if (
                visibleSentences.length > 0
                && (!currentSentence || !visibleSentenceIndexSet.has(currentSentence.index))
            ) {
                handleSeekToSentence(visibleSentences[0]);
                return;
            }
        }
        playerActions.togglePlay();
    }, [playing, stopTakeAudio, visibleSentences, currentSentence, visibleSentenceIndexSet, handleSeekToSentence]);

    const handlePrevSentence = useCallback(() => {
        if (visibleSentences.length === 0) {
            return;
        }
        const curIdx = currentSentence?.index;
        if (curIdx === undefined) {
            handleSeekToSentence(visibleSentences[0]);
            return;
        }
        const pos = visibleSentences.findIndex((s) => s.index === curIdx);
        if (pos > 0) {
            handleSeekToSentence(visibleSentences[pos - 1]);
            return;
        }
        if (pos === 0) {
            return;
        }
        // 当前播放位置落入被省略区间时，回退到省略区间前最近的一句可见字幕
        for (let i = visibleSentences.length - 1; i >= 0; i--) {
            if (visibleSentences[i].index < curIdx) {
                handleSeekToSentence(visibleSentences[i]);
                return;
            }
        }
    }, [visibleSentences, currentSentence, handleSeekToSentence]);

    const handleNextSentence = useCallback(() => {
        if (visibleSentences.length === 0) {
            return;
        }
        const curIdx = currentSentence?.index;
        if (curIdx === undefined) {
            handleSeekToSentence(visibleSentences[0]);
            return;
        }
        const pos = visibleSentences.findIndex((s) => s.index === curIdx);
        if (pos >= 0 && pos < visibleSentences.length - 1) {
            handleSeekToSentence(visibleSentences[pos + 1]);
            return;
        }
        if (pos === visibleSentences.length - 1) {
            return;
        }
        // 当前播放位置落入被省略区间时，前进到省略区间后最近的一句可见字幕
        for (let i = 0; i < visibleSentences.length; i++) {
            if (visibleSentences[i].index > curIdx) {
                handleSeekToSentence(visibleSentences[i]);
                return;
            }
        }
    }, [visibleSentences, currentSentence, handleSeekToSentence]);

    const handleRepeatSentence = useCallback(() => {
        stopTakeAudio();
        activeDubbedSentenceRef.current = null;
        setReplayTick((prev) => prev + 1);
        playerActions.repeatCurrent({ loop: false });
    }, [stopTakeAudio]);

    const handlePlayTake = useCallback((record: DubbingSentenceRecord) => {
        if (playingTakeIndex === record.index) {
            stopTakeAudio();
            return;
        }
        if (!record.take.filePath) {
            return;
        }
        stopTakeAudio();
        playerActions.pause();

        const audio = new Audio(UrlUtil.toUrl(record.take.filePath));
        audio.volume = 0.9;
        audio.onended = () => {
            setPlayingTakeIndex(null);
            audioRef.current = null;
        };
        audioRef.current = audio;
        setPlayingTakeIndex(record.index);
        void audio.play().catch((error) => {
            logger.error('试听配音失败', { sentenceIndex: record.index, error });
            setPlayingTakeIndex(null);
            audioRef.current = null;
        });
    }, [playingTakeIndex, stopTakeAudio]);

    const handleClearSentence = useCallback(async (sentenceIndex: number) => {
        if (playingTakeIndex === sentenceIndex) {
            stopTakeAudio();
        }
        setClearingIndex(sentenceIndex);
        try {
            await dubbingApi.clearSentence({ videoKey: entry.videoKey, sentenceIndex });
            setManifest((prev) => {
                if (!prev) {
                    return prev;
                }
                const nextSentences = { ...prev.sentences };
                delete nextSentences[String(sentenceIndex)];
                return { ...prev, sentences: nextSentences };
            });
            await onSentenceCleared();
            toast.success(t('dubbingExport.preview.sentenceCleared'));
        } catch (error) {
            logger.error('删除单句配音失败', { videoKey: entry.videoKey, sentenceIndex, error });
            toast.error(t('dubbingExport.clearFailed'));
        } finally {
            setClearingIndex(null);
        }
    }, [entry.videoKey, onSentenceCleared, playingTakeIndex, stopTakeAudio, t]);

    const renderExportFeedback = (): ReactNode => {
        if (!exportState) {
            return null;
        }
        if (exportState.stage === 'running') {
            return (
                <div className="flex items-center gap-2 w-44">
                    <Progress value={exportState.progress} className="flex-1 h-1.5" />
                    <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                        {t('dubbingExport.exporting', { progress: exportState.progress })}
                    </span>
                </div>
            );
        }
        if (exportState.stage === 'done') {
            return (
                <button
                    type="button"
                    onClick={() => void dubbingApi.openFolder(exportState.outputPath)}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                    <FolderOpen className="w-3.5 h-3.5" />
                    {t('dubbingExport.openFolder')}
                </button>
            );
        }
        return (
            <span className="text-xs text-red-500 max-w-xs truncate" title={exportState.message}>
                {exportState.message || t('dubbingExport.exportFailed')}
            </span>
        );
    };

    const renderDubbedControls = (record: DubbingSentenceRecord, sentence?: Sentence): ReactNode => {
        const isPlayingTake = playingTakeIndex === record.index;
        const { speedFactor, overSec } = getSpeedInfo(record.take.durationSec, sentence);
        const showOverHint = speedFactor >= 1.05 && overSec >= 0.1;
        return (
            <div className="flex items-center gap-1 shrink-0">
                <span
                    className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] tabular-nums mr-0.5',
                        showOverHint
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            : 'bg-primary/10 text-primary',
                    )}
                    title={
                        showOverHint
                            ? t('dubbingExport.preview.speedUpHint', {
                                over: overSec.toFixed(1),
                                rate: speedFactor.toFixed(1),
                            })
                            : undefined
                    }
                >
                    <Mic className="w-3 h-3" />
                    {showOverHint && `+${overSec.toFixed(1)}s`}
                </span>
                <Button
                    type="button"
                    size="sm"
                    variant={isPlayingTake ? 'secondary' : 'ghost'}
                    className="h-7 px-2 rounded-md text-xs"
                    disabled={!record.take.filePath}
                    onClick={(e) => {
                        e.stopPropagation();
                        handlePlayTake(record);
                    }}
                    title={isPlayingTake ? t('dubbingExport.preview.stopTake') : t('dubbingExport.preview.playTake')}
                >
                    {isPlayingTake ? <Square className="w-3 h-3 fill-current" /> : <Volume2 className="w-3.5 h-3.5" />}
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                    disabled={clearingIndex === record.index}
                    onClick={(e) => {
                        e.stopPropagation();
                        void handleClearSentence(record.index);
                    }}
                    aria-label={t('dubbingExport.preview.clearSentence')}
                    title={t('dubbingExport.preview.clearSentence')}
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </Button>
            </div>
        );
    };

    return (
        <div className="w-full h-full min-h-0 flex flex-col gap-3 overflow-hidden">
            {/* 顶部区域：左侧精简播放器 + 右上角导出按钮 */}
            <div className="shrink-0 flex items-stretch justify-between gap-4 rounded-xl border border-border/60 bg-card p-3">
                <div className="flex items-stretch gap-3.5 min-w-0 flex-1">
                    <div className="w-[216px] shrink-0">
                        <AspectRatio ratio={16 / 9} className="w-full">
                            <div className="w-full h-full rounded-lg overflow-hidden bg-black">
                                <PlayerEngine
                                    width="100%"
                                    height="100%"
                                    onReady={handlePlayerReady}
                                    onProvideVideoElement={handleProvideVideoElement}
                                />
                            </div>
                        </AspectRatio>
                    </div>

                    <div className="min-w-0 flex-1 flex flex-col justify-between py-0.5">
                        <div className="text-xs text-foreground/85 line-clamp-2 leading-5">
                            {currentSentence?.text ?? (
                                <span className="text-muted-foreground/70">{t('dubbingExport.preview.pickSentenceHint')}</span>
                            )}
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                            <Button
                                type="button"
                                size="sm"
                                variant={playing ? 'secondary' : 'default'}
                                className="h-7 px-2.5 rounded-lg text-xs"
                                disabled={!playerReady}
                                onClick={handleToggleVideoPlay}
                            >
                                {playing ? <Pause className="w-3.5 h-3.5 mr-1" /> : <Play className="w-3.5 h-3.5 mr-1 fill-current" />}
                                {playing ? t('dubbingExport.preview.pause') : t('dubbingExport.preview.play')}
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 rounded-lg text-xs text-muted-foreground hover:text-foreground"
                                disabled={!playerReady || !currentSentence}
                                onClick={handleRepeatSentence}
                            >
                                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                                {t('dubbingExport.preview.repeat')}
                            </Button>
                            {playing && currentSentence && manifest?.sentences[String(currentSentence.index)] && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px]">
                                    <Mic className="w-3 h-3" />
                                    {t('dubbingExport.preview.playingDubbed')}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* 右上角：导出当前视频与状态反馈 */}
                <div className="shrink-0 flex flex-col items-end justify-between py-0.5">
                    <div className="flex items-center gap-1.5">
                        <Button
                            size="sm"
                            variant="default"
                            className="h-8 px-3 rounded-lg text-xs"
                            disabled={exporting || dubbedRecords.length === 0}
                            onClick={onExport}
                        >
                            <Download className="w-3.5 h-3.5 mr-1.5" />
                            {t('dubbingExport.export')}
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                            disabled={exporting}
                            onClick={onClearVideo}
                            aria-label={t('dubbingExport.clear')}
                            title={t('dubbingExport.clear')}
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                    {renderExportFeedback()}
                </div>
            </div>

            {/* 下方：合二为一的精简配音列表（已配音句 + 前后各一句上下文，其余省略） */}
            <div className="flex-1 min-h-0 rounded-xl border border-border/60 bg-card overflow-hidden">
                {loadingDetail ? (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                ) : subtitleError ? (
                    dubbedRecords.length === 0 ? (
                        <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground p-6 text-center">
                            {subtitleError}
                        </div>
                    ) : (
                        <div className="w-full h-full overflow-y-auto p-2 flex flex-col gap-1">
                            <div className="px-3 py-1.5 text-[11px] text-muted-foreground">{subtitleError}</div>
                            {dubbedRecords.map((record) => (
                                <div
                                    key={record.index}
                                    className="flex items-center gap-3 rounded-lg px-3 py-2 border border-border/40 bg-accent/20"
                                >
                                    <span className="text-[11px] font-mono text-muted-foreground tabular-nums w-8 shrink-0">
                                        #{record.index + 1}
                                    </span>
                                    <div className="min-w-0 flex-1 text-xs text-foreground">
                                        {t('dubbingExport.preview.sentenceFallback', { index: record.index + 1 })}
                                    </div>
                                    {renderDubbedControls(record)}
                                </div>
                            ))}
                        </div>
                    )
                ) : dubbedRecords.length === 0 ? (
                    <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground p-6 text-center">
                        {t('dubbingExport.preview.emptyDubbed')}
                    </div>
                ) : (
                    <div className="w-full h-full overflow-y-auto p-2 flex flex-col gap-1">
                        {contextItems.map((item) => {
                            if (item.type === 'gap') {
                                return (
                                    <div
                                        key={item.id}
                                        className="flex items-center justify-center gap-1.5 py-1.5 my-0.5 text-[11px] text-muted-foreground/60 select-none"
                                    >
                                        <MoreHorizontal className="w-3.5 h-3.5" />
                                        <span>{t('dubbingExport.preview.omittedCount', { count: item.omittedCount })}</span>
                                    </div>
                                );
                            }

                            const { sentence, isDubbed } = item;
                            const record = isDubbed ? manifest?.sentences[String(sentence.index)] : undefined;
                            const isActive = currentSentence?.index === sentence.index;

                            return (
                                <div
                                    key={sentence.index}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => handleSeekToSentence(sentence)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            handleSeekToSentence(sentence);
                                        }
                                    }}
                                    className={cn(
                                        'flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer transition-colors border',
                                        isActive
                                            ? 'border-primary/40 bg-accent/70'
                                            : isDubbed
                                                ? 'border-border/50 bg-accent/25 hover:bg-accent/50'
                                                : 'border-transparent hover:bg-accent/30 opacity-75',
                                    )}
                                >
                                    <span className="text-[11px] font-mono text-muted-foreground tabular-nums w-8 shrink-0">
                                        #{sentence.index + 1}
                                    </span>
                                    <div
                                        className={cn(
                                            'min-w-0 flex-1 text-xs leading-5',
                                            isDubbed ? 'text-foreground font-medium' : 'text-muted-foreground',
                                        )}
                                    >
                                        {sentence.text}
                                    </div>
                                    {record && renderDubbedControls(record, sentence)}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <VideoPlayerShortcut
                onPlayPause={handleToggleVideoPlay}
                onPrevSentence={handlePrevSentence}
                onNextSentence={handleNextSentence}
                onRepeatSentence={handleRepeatSentence}
                onChangeSingleRepeat={() => playerActions.setSingleRepeat(!singleRepeat)}
                onChangeAutoPause={() => playerActions.setAutoPause(!autoPause)}
            />
        </div>
    );
}
