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

export interface TranscriptItemProps {
    file: string;
    onStart: () => void;
    onDelete: () => void;
}

const api = backendClient;

const TranscriptItem = ({ file, onStart, onDelete }: TranscriptItemProps) => {
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

    // 从 useTranscript store 获取任务信息
    const task = files.find(f => f.file === file);
    logger.debug('task status updated', { task });

    // 同步任务状态
    React.useEffect(() => {
        if (task && task.status) {
            const status = task.status as DpTaskState;
            if (status === DpTaskState.DONE || status === DpTaskState.CANCELLED || status === DpTaskState.FAILED) {
                setStarted(false);
            }
        }
    }, [task]);

    let msg = '未开始';
    if (task && task.status) {
        const status = task.status as DpTaskState;
        switch (status) {
            case DpTaskState.INIT:
                msg = '初始化中...';
                break;
            case DpTaskState.IN_PROGRESS:
                msg = task.result?.message || '处理中...';
                break;
            case DpTaskState.DONE: {
                if (task.updated_at && task.created_at) {
                    const updatedAt = TimeUtil.isoToDate(task.updated_at).getTime();
                    const createdAt = TimeUtil.isoToDate(task.created_at).getTime();
                    const duration = Math.floor((updatedAt - createdAt) / 1000);
                    logger.debug('task duration calculated', { duration, updatedAt: task.updated_at, createdAt: task.created_at });
                    msg = `完成 ${duration}s`;
                } else {
                    msg = '完成';
                }
                break;
            }
            case DpTaskState.CANCELLED:
                msg = '已取消';
                break;
            case DpTaskState.FAILED:
                msg = '失败';
                break;
            default:
                msg = task.result?.message || '未知状态';
        }
    }

    // 取消转录任务
    const handleCancelTranscription = async () => {
        setCancelling(true);
        try {
            const success = await api.call('ai-func/cancel-transcription', { filePath: file });
            if (success) {
                logger.info('Transcription cancelled successfully', { file });
            } else {
                // 返回 false 表示任务不存在，此时前端更新任务状态为已取消
                logger.warn('Failed to cancel transcription - task does not exist, updating status to cancelled', { file });
                useTranscript.getState().updateTranscriptTasks([{
                    filePath: file,
                    status: DpTaskState.CANCELLED,
                    result: { message: '转录任务已取消' }
                }]);
            }
        } catch (error) {
            logger.error('Error cancelling transcription', { file, error });
        } finally {
            setCancelling(false);
        }
    };
    return (
        <TableRow>
            <TableCell className="font-medium">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger className={'text-left f'}>
                            {fInfo.baseName}
                        </TooltipTrigger>
                        <TooltipContent>
                            {file}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </TableCell>
            <TableCell className={cn('')}>{msg}</TableCell>
            <TableCell className={cn(' flex')}>
                <Button
                    onClick={() => {
                        onStart();
                        setStarted(true);
                    }}
                    disabled={!task || (task.status as DpTaskState) === DpTaskState.IN_PROGRESS || (task.status as DpTaskState) === DpTaskState.INIT || (started && !task)}
                    size={'sm'} className={'mx-auto'}>转录</Button>
                <Button
                    onClick={() => {
                        const status = task?.status as DpTaskState;
                        if (!task || !status || status === DpTaskState.DONE || status === DpTaskState.CANCELLED || status === DpTaskState.FAILED) {
                            onDelete();
                        } else {
                            handleCancelTranscription();
                        }
                    }}
                    variant={'secondary'}
                    size={'sm'} className={'mx-auto'}
                    disabled={cancelling}>
                    {cancelling ? '取消中...' :
                     (() => {
                         const status = task?.status as DpTaskState;
                         if (!task || !status || status === DpTaskState.DONE || status === DpTaskState.CANCELLED || status === DpTaskState.FAILED) {
                             return '删除';
                         } else {
                             return '取消';
                         }
                     })()}
                </Button>
            </TableCell>
        </TableRow>
    );
};

export default TranscriptItem;
