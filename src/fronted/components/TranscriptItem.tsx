import { TableCell, TableRow } from '@/fronted/components/ui/table';
import { cn } from '@/fronted/lib/utils';
import { Button } from '@/fronted/components/ui/button';
import React from 'react';
import { DpTaskState } from '@/backend/db/tables/dpTask';
import useSWR from 'swr';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import TimeUtil from '@/common/utils/TimeUtil';
import Util from '@/common/utils/Util';
import toast from 'react-hot-toast';
import useDpTaskViewer from '@/fronted/hooks/useDpTaskViewer';

export interface TranscriptItemProps {
    file: string;
    taskId: number | null;
    onStart: () => void;
    onDelete: () => void;
}

const api = window.electron;

const TranscriptItem = ({ file, taskId, onStart, onDelete }: TranscriptItemProps) => {
    const [started, setStarted] = React.useState(false);
    const { task } = useDpTaskViewer(taskId);
    const { data: fInfo } = useSWR(['system/path-info', file], ([_k, f]) => api.call('system/path-info', f), {
        fallbackData: {
            baseName: '',
            dirName: '',
            extName: ''
        }
    });
    console.log('taskk', task);

    let msg = task?.progress ?? '未开始';
    if (task?.status === DpTaskState.IN_PROGRESS) {
        console.log(task.created_at, task.updated_at);
        const createdAt = TimeUtil.isoToDate(task.created_at).getTime();
        const now = new Date().getTime();
        const duration = Math.floor((now - createdAt) / 1000);
        msg = `${task.progress} ${duration}s`;
    }
    if (task?.status === DpTaskState.DONE) {
        const updatedAt = TimeUtil.isoToDate(task.updated_at).getTime();
        const createdAt = TimeUtil.isoToDate(task.created_at).getTime();
        const duration = Math.floor((updatedAt - createdAt) / 1000);
        console.log('duration', duration, TimeUtil.isoToDate(task.updated_at), TimeUtil.isoToDate(task.created_at));
        msg = `${task.progress} ${duration}s`;
    }
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
                    disabled={Util.cmpTaskState(task, [DpTaskState.IN_PROGRESS] )|| (started && task === null)}
                    size={'sm'} className={'mx-auto'}>转录</Button>
                <Button
                    onClick={() => {
                        if (Util.cmpTaskState(task, [DpTaskState.DONE, DpTaskState.CANCELLED, DpTaskState.FAILED, 'none'])) {
                            onDelete();
                        } else {
                            api.call('dp-task/cancel', taskId ?? undefined);
                        }
                    }}
                    variant={'secondary'}
                    size={'sm'} className={'mx-auto'}>
                    {Util.cmpTaskState(task, [DpTaskState.DONE, DpTaskState.CANCELLED, DpTaskState.FAILED, 'none']) ? '删除' : '取消'}
                </Button>
            </TableCell>
        </TableRow>
    );
};

export default TranscriptItem;
