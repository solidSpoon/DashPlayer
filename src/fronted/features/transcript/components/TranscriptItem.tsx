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

    let msg = t('subtitleWorkspace.status.notStarted');
    if (task && task.status) {
        const status = task.status as TranscriptTaskState;
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

    const status = task?.status as TranscriptTaskState;
    const isFinished = !task || !status || status === TranscriptTaskState.DONE || status === TranscriptTaskState.CANCELLED || status === TranscriptTaskState.FAILED;

    return (
        <TableRow>
            <TableCell className="font-medium">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger className="text-left">
                            {fInfo?.baseName}
                        </TooltipTrigger>
                        <TooltipContent>
                            {file}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </TableCell>
            <TableCell className={cn(
                'text-sm',
                status === TranscriptTaskState.DONE && 'text-green-600 dark:text-green-400',
                status === TranscriptTaskState.FAILED && 'text-destructive',
                status === TranscriptTaskState.CANCELLED && 'text-muted-foreground'
            )}>{msg}</TableCell>
            <TableCell className="flex gap-1">
                <Button
                    onClick={async () => {
                        const result = await onStart();
                        if (result === 'model_missing') {
                            toast.error(t('subtitleWorkspace.modelMissing'));
                            return;
                        }
                        setStarted(true);
                    }}
                    disabled={!task || (task.status as TranscriptTaskState) === TranscriptTaskState.IN_PROGRESS || (task.status as TranscriptTaskState) === TranscriptTaskState.INIT || (started && !task)}
                    size="sm"
                    className="mx-auto"
                >{t('subtitleWorkspace.actions.transcribe')}</Button>
                <Button
                    onClick={() => {
                        if (isFinished) {
                            void onDelete();
                        } else {
                            handleCancelTranscription();
                        }
                    }}
                    variant="secondary"
                    size="sm"
                    className="mx-auto"
                    disabled={cancelling}
                >
                    {cancelling
                        ? t('subtitleWorkspace.status.cancelling')
                        : isFinished
                            ? t('subtitleWorkspace.actions.delete')
                            : t('subtitleWorkspace.actions.cancel')}
                </Button>
            </TableCell>
        </TableRow>
    );
};

export default TranscriptItem;
