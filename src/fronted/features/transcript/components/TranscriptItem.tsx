import { Button } from '@/fronted/components/ui/button';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    type TranscriptTask,
    TranscriptTaskState,
} from '@/common/contracts/transcript/transcript-task';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import TimeUtil from '@/common/utils/TimeUtil';
import MediaUtil from '@/common/utils/MediaUtil';
import UrlUtil from '@/common/utils/UrlUtil';
import { SWR_KEY } from '@/fronted/lib/swr-util';
import useInView from '@/fronted/hooks/useInView';
import useSWR from 'swr';
import { transcriptApi } from '../transcriptApi';
import { fileBrowserApi } from '@/fronted/features/file-browser/fileBrowserApi';
import useLayout from '@/fronted/hooks/useLayout';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { CheckCircle2, Clock, FileAudio2, FileVideo, Loader2, Play, RotateCcw, Trash2, XCircle } from 'lucide-react';

/** 超过 12 小时（秒）视为隔天或异常跨度，不展示具体耗时数字。 */
const MAX_REASONABLE_ELAPSED_SEC = 43200;

/**
 * 将转录耗时秒数格式化为可读短文本；异常跨度返回 null。
 *
 * @param seconds 耗时秒数。
 * @returns 如 `37s`、`1m 17s`、`1h 2m`，异常或负数返回 `null`。
 */
function formatElapsedDuration(seconds: number): string | null {
    if (!Number.isFinite(seconds) || seconds < 0 || seconds >= MAX_REASONABLE_ELAPSED_SEC) {
        return null;
    }
    if (seconds < 60) {
        return `${seconds}s`;
    }
    if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    }
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * 从完整目录路径提取末级文件夹名，用于列表精简展示。
 *
 * @param dirName 目录绝对路径。
 * @returns 末级文件夹名。
 */
function formatParentFolder(dirName?: string): string {
    if (!dirName) return '';
    const segments = dirName.split(/[\\/]/).filter(Boolean);
    return segments[segments.length - 1] ?? dirName;
}

/** 单个转录任务行的输入属性。 */
export interface TranscriptItemProps {
    /** 后端返回的转录任务。 */
    task: TranscriptTask;
    /** 启动转录并返回启动结果。 */
    onStart: () => Promise<'started' | 'model_missing'>;
    /** 从转录队列移除任务。 */
    onDelete: () => Promise<void>;
}

/** 展示单个转录任务，并提供开始、去播放、重试、取消与删除操作。 */
const TranscriptItem = ({ task, onStart, onDelete }: TranscriptItemProps) => {
    const { t } = useI18nTranslation('pages');
    const navigate = useNavigate();
    const [started, setStarted] = React.useState(false);
    const [cancelling, setCancelling] = React.useState(false);
    const [openingPlayer, setOpeningPlayer] = React.useState(false);
    const [thumbnailError, setThumbnailError] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const inView = useInView(containerRef);
    const logger = getRendererLogger('TranscriptItem');
    const file = task.file;
    const isVideo = MediaUtil.isVideo(file);
    const { data: fInfo } = useSWR(['system/path-info', file], ([_k, f]) => transcriptApi.getPathInfo(f));
    const { data: thumbnail } = useSWR(
        inView && isVideo ? [SWR_KEY.SPLIT_VIDEO_THUMBNAIL, file, 0] : null,
        ([_key, path, time]: [string, string, number]) => fileBrowserApi.getThumbnail(path, time)
    );

    const [lastThumbnail, setLastThumbnail] = React.useState(thumbnail);
    if (thumbnail !== lastThumbnail) {
        setLastThumbnail(thumbnail);
        setThumbnailError(false);
    }

    logger.debug('task status updated', { file, status: task.status });

    React.useEffect(() => {
        if (task && task.status) {
            const status = task.status as TranscriptTaskState;
            if (status === TranscriptTaskState.DONE || status === TranscriptTaskState.CANCELLED || status === TranscriptTaskState.FAILED) {
                window.setTimeout(() => setStarted(false), 0);
            }
        }
    }, [task]);

    const status = task?.status as TranscriptTaskState;

    let msg = t('subtitleWorkspace.status.notStarted');
    if (task && task.status) {
        switch (status) {
            case TranscriptTaskState.INIT:
                msg = t('subtitleWorkspace.status.initializing');
                break;
            case TranscriptTaskState.IN_PROGRESS:
                msg = task.result?.message || t('subtitleWorkspace.status.processing');
                break;
            case TranscriptTaskState.DONE: {
                const updatedAt = TimeUtil.isoToDate(task.updated_at).getTime();
                const createdAt = TimeUtil.isoToDate(task.created_at).getTime();
                const durationSec = Math.floor((updatedAt - createdAt) / 1000);
                const formatted = formatElapsedDuration(durationSec);
                msg = formatted
                    ? t('subtitleWorkspace.status.doneWithDuration', { duration: formatted })
                    : t('subtitleWorkspace.status.done');
                break;
            }
            case TranscriptTaskState.CANCELLED:
                msg = t('subtitleWorkspace.status.cancelled');
                break;
            case TranscriptTaskState.FAILED:
                msg = task.result?.message || t('subtitleWorkspace.status.failed');
                break;
            default:
                msg = task.result?.message || t('subtitleWorkspace.status.unknown');
        }
    }

    const handleCancelTranscription = async () => {
        setCancelling(true);
        try {
            const success = await transcriptApi.cancelTranscription(file);
            if (success) {
                logger.info('Transcription cancelled successfully', { file });
            } else {
                throw new Error(`后端不存在可取消的转录任务: ${file}`);
            }
        } catch (error) {
            logger.error('Error cancelling transcription', { file, error });
            toast.error(error instanceof Error ? error.message : String(error));
        } finally {
            setCancelling(false);
        }
    };

    const handleStart = async () => {
        const result = await onStart();
        if (result === 'model_missing') {
            toast.error(t('subtitleWorkspace.modelMissing'));
            return;
        }
        setStarted(true);
    };

    /**
     * 打开播放器播放当前已转录完成的视频。
     */
    const handleOpenPlayer = async () => {
        if (openingPlayer) return;
        setOpeningPlayer(true);
        try {
            const [videoId] = await transcriptApi.createWatchHistory([file]);
            if (videoId) {
                await fileBrowserApi.changeWindowSize('player');
                useLayout.getState().changeSideBar(false);
                navigate(`/player/${videoId}`);
            }
        } catch (error) {
            logger.error('Error opening video in player', { file, error });
            toast.error(error instanceof Error ? error.message : String(error));
        } finally {
            setOpeningPlayer(false);
        }
    };

    const isFinished = !task || !status || status === TranscriptTaskState.DONE || status === TranscriptTaskState.CANCELLED || status === TranscriptTaskState.FAILED;
    const isRunning = status === TranscriptTaskState.IN_PROGRESS || status === TranscriptTaskState.INIT || started;
    const isDone = status === TranscriptTaskState.DONE;
    const isFailed = status === TranscriptTaskState.FAILED;
    const isFailedOrCancelled = status === TranscriptTaskState.FAILED || status === TranscriptTaskState.CANCELLED;

    const doneDurationText = isDone && task
        ? formatElapsedDuration(
            Math.floor((TimeUtil.isoToDate(task.updated_at).getTime() - TimeUtil.isoToDate(task.created_at).getTime()) / 1000)
        )
        : null;

    const percentMatch = isRunning ? msg.match(/(\d{1,3})%/) : null;
    const progressPercent = isRunning
        ? (percentMatch
            ? Math.min(100, Math.max(0, Number(percentMatch[1])))
            : (task.result?.totalChunks && task.result.totalChunks > 0 && task.result.currentChunk !== undefined)
                ? Math.min(100, Math.round((task.result.currentChunk / task.result.totalChunks) * 100))
                : null)
        : null;

    const folderLabel = formatParentFolder(fInfo?.dirName);
    const extLabel = fInfo?.extName ? fInfo.extName.replace(/^\./, '').toUpperCase() : '';
    const subMeta = [folderLabel, extLabel].filter(Boolean).join(' · ') || file;

    const renderInlineStatus = () => {
        if (isRunning) {
            return (
                <span className="inline-flex items-center gap-1 text-foreground/80 font-medium tabular-nums">
                    <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" />
                    <span>{msg}</span>
                </span>
            );
        }
        if (isDone) {
            return (
                <span className="inline-flex items-center gap-1 text-foreground/80">
                    <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-medium">{t('subtitleWorkspace.status.done')}</span>
                    {doneDurationText && (
                        <span className="text-muted-foreground/75 tabular-nums">· {doneDurationText}</span>
                    )}
                </span>
            );
        }
        if (isFailed) {
            return (
                <span className="inline-flex items-center gap-1 text-destructive font-medium truncate" title={msg}>
                    <XCircle className="h-3 w-3 shrink-0" />
                    <span className="truncate">{msg}</span>
                </span>
            );
        }
        if (status === TranscriptTaskState.CANCELLED) {
            return (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <XCircle className="h-3 w-3 shrink-0 opacity-60" />
                    <span>{t('subtitleWorkspace.status.cancelled')}</span>
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3 shrink-0 opacity-70" />
                <span>{t('subtitleWorkspace.status.notStarted')}</span>
            </span>
        );
    };

    const showThumbnail = Boolean(thumbnail) && !thumbnailError;

    return (
        <div
            ref={containerRef}
            className="relative h-[84px] shrink-0 overflow-hidden rounded-xl border border-border/70 bg-card px-3.5 shadow-2xs hover:border-border hover:shadow-xs transition-all group flex items-center gap-3.5"
        >
            {/* 左侧缩略图 + 文件信息 + 内联状态 */}
            <div className="flex-1 min-w-0">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger className="text-left flex items-center gap-3.5 w-full min-w-0">
                            <div className="relative w-[106px] h-[60px] shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted/60 flex items-center justify-center text-muted-foreground">
                                {showThumbnail ? (
                                    <img
                                        src={UrlUtil.toUrl(thumbnail ?? '')}
                                        alt=""
                                        className="w-full h-full object-cover"
                                        onError={() => setThumbnailError(true)}
                                    />
                                ) : isVideo ? (
                                    <FileVideo className="h-5 w-5 opacity-70" />
                                ) : (
                                    <FileAudio2 className="h-5 w-5 opacity-70" />
                                )}
                            </div>
                            <div className="min-w-0 flex-1 overflow-hidden">
                                <div className="truncate text-sm font-medium text-foreground">
                                    {fInfo?.baseName || file}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground/80 mt-1.5 min-w-0">
                                    <span className="shrink-0">{subMeta}</span>
                                    <span className="text-border shrink-0">•</span>
                                    <span className="min-w-0 truncate">{renderInlineStatus()}</span>
                                </div>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs max-w-md break-all">
                            {isFailed && task.result?.message ? `${file}\n${task.result.message}` : file}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>

            {/* 右侧操作按钮组：固定主按钮槽位（w-20）+ 最右删除占位槽（w-8），保证所有状态垂直对齐 */}
            <div className="shrink-0 flex items-center justify-end gap-1.5">
                {isDone && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    onClick={() => void handleStart()}
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent className="text-xs">
                                {t('subtitleWorkspace.actions.retranscribe')}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}

                {isDone ? (
                    <Button
                        onClick={() => void handleOpenPlayer()}
                        variant="secondary"
                        size="sm"
                        disabled={openingPlayer}
                        className="h-8 w-20 px-0 gap-1 text-xs font-medium shadow-2xs justify-center"
                    >
                        {openingPlayer ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Play className="h-3.5 w-3.5" />
                        )}
                        <span>{t('subtitleWorkspace.actions.playVideo')}</span>
                    </Button>
                ) : (!isRunning || isFinished) ? (
                    <Button
                        onClick={() => void handleStart()}
                        variant="outline"
                        size="sm"
                        className="h-8 w-20 px-0 gap-1 text-xs font-medium text-foreground/85 hover:text-foreground hover:border-foreground/30 shadow-2xs justify-center"
                    >
                        {isFailedOrCancelled && <RotateCcw className="h-3.5 w-3.5" />}
                        <span>
                            {isFailedOrCancelled
                                ? t('subtitleWorkspace.actions.retry')
                                : t('subtitleWorkspace.actions.transcribe')}
                        </span>
                    </Button>
                ) : (
                    <Button
                        onClick={handleCancelTranscription}
                        variant="outline"
                        size="sm"
                        className="h-8 w-20 px-0 text-xs font-medium text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/5 transition-colors justify-center"
                        disabled={cancelling}
                    >
                        {cancelling && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                        <span>
                            {cancelling
                                ? t('subtitleWorkspace.status.cancelling')
                                : t('subtitleWorkspace.actions.cancel')}
                        </span>
                    </Button>
                )}

                {isFinished ? (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    onClick={() => void onDelete()}
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent className="text-xs">
                                {t('subtitleWorkspace.actions.delete')}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                ) : (
                    <div className="h-8 w-8 shrink-0" aria-hidden="true" />
                )}
            </div>

            {/* 卡片底边进度条：绝对定位贴底，不改变卡片固定高度 */}
            {isRunning && progressPercent !== null && (
                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-muted/70">
                    <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
            )}
        </div>
    );
};

export default TranscriptItem;
