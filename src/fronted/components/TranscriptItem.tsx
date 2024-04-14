import { TableCell, TableRow } from '@/fronted/components/ui/table';
import { cn } from '@/common/utils/Util';
import { Button } from '@/fronted/components/ui/button';
import React, { useEffect } from 'react';
import { DpTask, DpTaskState } from '@/backend/db/tables/dpTask';
import useDpTask from '@/fronted/hooks/useDpTask';
import useSWR from 'swr';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';

export interface TranscriptItemProps {
    file: string;
    taskId: number | null;
    onStart: () => void;
    onDelete: () => void;
}

const api = window.electron;

const TranscriptItem = ({ file, taskId, onStart, onDelete }: TranscriptItemProps) => {


    console.log('itemTaskId', taskId);
    const [started, setStarted] = React.useState(false);
    const task = useDpTask(taskId, 1000);
    const { data: fInfo } = useSWR(`system/path-info:${file}`, () => api.call('system/path-info', file), {
        fallbackData: {
            baseName: '',
            dirName: '',
            extName: ''
        }
    });
    let msg = task?.progress ?? '未开始';
    if (task?.status === DpTaskState.IN_PROGRESS) {
        console.log(task.created_at, task.updated_at);
        // update at - create at as duration, both is iso string, return seconds
        // const updatedAt = new Date(task.updated_at).getTime();
        // Convert created_at to ISO 8601 format
        const createdAt = new Date(task.created_at.replace(' ', 'T') + 'Z').getTime();
        const now = new Date().getTime();
        // const duration = (now - createdAt) / 1000;
        const duration = Math.floor((now - createdAt) / 1000);
        msg = `进行中 ${duration}s`;
    }
    if (task?.status === DpTaskState.DONE) {
        const updatedAt = new Date(task.updated_at).getTime();
        const createdAt = new Date(task.created_at.replace(' ', 'T') + 'Z').getTime();
        const duration = Math.floor((updatedAt - createdAt) / 1000);
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
                    disabled={(task?.status ?? DpTaskState.INIT) !== DpTaskState.INIT || (started && task === null)}
                    size={'sm'} className={'mx-auto'}>转录</Button>
                <Button
                    onClick={onDelete}
                    variant={'secondary'}
                    size={'sm'} className={'mx-auto'}>删除</Button>
            </TableCell>
        </TableRow>
    );
};

export default TranscriptItem;
