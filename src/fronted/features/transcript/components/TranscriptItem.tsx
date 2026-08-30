import { TableCell, TableRow } from '@/fronted/components/ui/table';
import { cn } from '@/fronted/lib/utils';
import { Button } from '@/fronted/components/ui/button';
import React from 'react';
import {
    TranscriptTask,
    TranscriptTaskState,
} from '@/common/contracts/transcript/transcript-task';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import TimeUtil from '@/common/utils/TimeUtil';
import useSWR from 'swr';
import { transcriptApi } from '../transcriptApi';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { CheckCircle2, Clock, FileVideo, Loader2, Play, Trash2, XCircle } from 'lucide-react';

/** 单个转录任务行的输入属性。 */
export interface TranscriptItemProps {
    /** 后端返回的转录任务。 */
    task: TranscriptTask;
    /** 启动转录并返回启动结果。 */
    onStart: () => Promise<'started' | 'model_missing'>;
    /** 从转录队列移除任务。 */
    onDelete: () => Promise<void>;
}

/** 展示单个转录任务，并提供开始、取消和删除操作。 */
const TranscriptItem = ({ task, onStart, onDelete }: TranscriptItemProps) => {
    const { t } = useI18nTranslation('pages');
    const [started, setStarted] = React.useState(false);
    const [cancelling, setCancelling] = React.useState(false);
    const logger = getRendererLogger('TranscriptItem');
    const file = task.file;
    const { data: fInfo } = useSWR(['system/path-info', file], ([_k, f]) => transcriptApi.getPathInfo(f));

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
                const duration = Math.floor((updatedAt - createdAt) / 1000);
                logger.debug('task duration calculated', { duration, updatedAt: task.updated_at, createdAt: task.created_at });
                msg = t('subtitleWorkspace.status.doneWithDuration', { duration });
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

    const isFinished = !task || !status || status === TranscriptTaskState.DONE || status === TranscriptTaskState.CANCELLED || status === TranscriptTaskState.FAILED;
    const isRunning = status === TranscriptTaskState.IN_PROGRESS || status === TranscriptTaskState.INIT || started;

    const renderStatusBadge = () => {
        if (!task || !status) {
            return (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground border border-border/50">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{msg}</span>
                </span>
            );
        }
        if (status === TranscriptTaskState.INIT || status === TranscriptTaskState.IN_PROGRESS) {
            return (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 dark:bg-amber-400/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300 border border-amber-500/30 dark:border-amber-400/30 animate-pulse">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600 dark:text-amber-400" />
                    <span className="truncate max-w-[140px]" title={msg}>{msg}</span>
                </span>
            );
        }
        if (status === TranscriptTaskState.DONE) {
            return (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{msg}</span>
                </span>
            );
        }
        if (status === TranscriptTaskState.FAILED) {
            return (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive border border-destructive/20">
                    <XCircle className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate max-w-[120px]" title={msg}>{msg}</span>
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground border border-border/50">
                <span>{msg}</span>
            </span>
        );
    };

    return (
        <TableRow className="border-border/50 hover:bg-muted/30 transition-colors group">
            <TableCell className="font-medium pl-4 py-3 min-w-0 max-w-0">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger className="text-left flex items-center gap-2.5 w-full min-w-0">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/70 text-muted-foreground border border-border/60 group-hover:border-primary/30 group-hover:text-primary transition-colors">
                                <FileVideo className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1 overflow-hidden">
                                <div className="truncate text-sm font-medium text-foreground">
                                    {fInfo?.baseName || file}
                                </div>
                                <div className="truncate text-[11px] text-muted-foreground/80 font-normal">
                                    {file}
                                </div>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs max-w-md break-all">
                            {file}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </TableCell>
            <TableCell className="py-3">
                {renderStatusBadge()}
            </TableCell>
            <TableCell className="py-3 pr-4 text-right">
                <div className="flex items-center justify-end gap-1.5 shrink-0">
                    {/* 转录 / 重试按钮 */}
                    {(!isRunning || isFinished) && (
                        <Button
                            onClick={async () => {
                                const result = await onStart();
                                if (result === 'model_missing') {
                                    toast.error(t('subtitleWorkspace.modelMissing'));
                                    return;
                                }
                                setStarted(true);
                            }}
                            size="sm"
                            className="h-8 gap-1 px-3 text-xs font-medium shadow-2xs"
                        >
                            <Play className="h-3.5 w-3.5 fill-current" />
                            <span>{t('subtitleWorkspace.actions.transcribe')}</span>
                        </Button>
                    )}

                    {/* 取消 / 删除按钮 */}
                    <Button
                        onClick={() => {
                            if (isFinished) {
                                void onDelete();
                            } else {
                                handleCancelTranscription();
                            }
                        }}
                        variant={isFinished ? 'ghost' : 'destructive'}
                        size="sm"
                        className={cn(
                            'h-8 px-2.5 text-xs transition-colors',
                            isFinished && 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
                        )}
                        disabled={cancelling}
                    >
                        {cancelling ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : isFinished ? (
                            <Trash2 className="h-3.5 w-3.5" />
                        ) : (
                            <XCircle className="h-3.5 w-3.5" />
                        )}
                        <span className="ml-1">
                            {cancelling
                                ? t('subtitleWorkspace.status.cancelling')
                                : isFinished
                                    ? t('subtitleWorkspace.actions.delete')
                                    : t('subtitleWorkspace.actions.cancel')}
                        </span>
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    );
};

export default TranscriptItem;
