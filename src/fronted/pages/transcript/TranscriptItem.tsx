import { TableCell, TableRow } from '@/fronted/components/ui/table';
import { cn } from '@/fronted/lib/utils';
import { Button } from '@/fronted/components/ui/button';
import React from 'react';
import { DpTaskState } from '@/backend/infrastructure/db/tables/dpTask';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import TimeUtil from '@/common/utils/TimeUtil';
import useTranscript from '@/fronted/hooks/useTranscript';
import useSWR from "swr";
import { backendClient } from '@/fronted/application/bootstrap/backendClient';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

export interface TranscriptItemProps {
    file: string;
    onStart: () => Promise<'started' | 'model_missing'>;
    onDelete: () => void;
}

const api = backendClient;

const TranscriptItem = ({ file, onStart, onDelete }: TranscriptItemProps) => {
    const { t } = useI18nTranslation('pages');
    const [started, setStarted] = React.useState(false);
    const [cancelling, setCancelling] = React.useState(false);
    const logger = getRendererLogger('TranscriptItem');
    const files = useTranscript((state) => state.files);
    const { data: fInfo } = useSWR(['system/path-info', file], ([_k, f]) => api.call('system/path-info', f), {
        fallbackData: {
            baseName: '',
            dirName: '',
            extName: ''
        }
    });

    const task = files.find(f => f.file === file);
    logger.debug('task status updated', { task });

    React.useEffect(() => {
        if (task && task.status) {
            const status = task.status as DpTaskState;
            if (status === DpTaskState.DONE || status === DpTaskState.CANCELLED || status === DpTaskState.FAILED) {
                setStarted(false);
            }
        }
    }, [task]);

    let msg = t('subtitleWorkspace.status.notStarted');
    if (task && task.status) {
        const status = task.status as DpTaskState;
        switch (status) {
            case DpTaskState.INIT:
                msg = t('subtitleWorkspace.status.initializing');
                break;
            case DpTaskState.IN_PROGRESS:
                msg = task.result?.message || t('subtitleWorkspace.status.processing');
                break;
            case DpTaskState.DONE: {
                if (task.updated_at && task.created_at) {
                    const updatedAt = TimeUtil.isoToDate(task.updated_at).getTime();
                    const createdAt = TimeUtil.isoToDate(task.created_at).getTime();
                    const duration = Math.floor((updatedAt - createdAt) / 1000);
                    logger.debug('task duration calculated', { duration, updatedAt: task.updated_at, createdAt: task.created_at });
                    msg = t('subtitleWorkspace.status.doneWithDuration', { duration });
                } else {
                    msg = t('subtitleWorkspace.status.done');
                }
                break;
            }
            case DpTaskState.CANCELLED:
                msg = t('subtitleWorkspace.status.cancelled');
                break;
            case DpTaskState.FAILED:
                msg = task.result?.message || t('subtitleWorkspace.status.failed');
                break;
            default:
                msg = task.result?.message || t('subtitleWorkspace.status.unknown');
        }
    }

    const handleCancelTranscription = async () => {
        setCancelling(true);
        try {
            const success = await api.call('ai-func/cancel-transcription', { filePath: file });
            if (success) {
                logger.info('Transcription cancelled successfully', { file });
            } else {
                logger.warn('Failed to cancel transcription - task does not exist, updating status to cancelled', { file });
                useTranscript.getState().updateTranscriptTasks([{
                    filePath: file,
                    status: DpTaskState.CANCELLED,
                    result: { message: t('subtitleWorkspace.actions.cancelledMessage') }
                }]);
            }
        } catch (error) {
            logger.error('Error cancelling transcription', { file, error });
        } finally {
            setCancelling(false);
        }
    };

    const status = task?.status as DpTaskState;
    const isFinished = !task || !status || status === DpTaskState.DONE || status === DpTaskState.CANCELLED || status === DpTaskState.FAILED;

    return (
        <TableRow>
            <TableCell className="font-medium">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger className="text-left">
                            {fInfo.baseName}
                        </TooltipTrigger>
                        <TooltipContent>
                            {file}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </TableCell>
            <TableCell className={cn(
                'text-sm',
                status === DpTaskState.DONE && 'text-green-600 dark:text-green-400',
                status === DpTaskState.FAILED && 'text-destructive',
                status === DpTaskState.CANCELLED && 'text-muted-foreground'
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
                    disabled={!task || (task.status as DpTaskState) === DpTaskState.IN_PROGRESS || (task.status as DpTaskState) === DpTaskState.INIT || (started && !task)}
                    size="sm"
                    className="mx-auto"
                >{t('subtitleWorkspace.actions.transcribe')}</Button>
                <Button
                    onClick={() => {
                        if (isFinished) {
                            onDelete();
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
