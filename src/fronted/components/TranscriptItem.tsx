import FileT from '@/common/types/FileT';
import { TableCell, TableRow } from '@/fronted/components/ui/table';
import { cn } from '@/common/utils/Util';
import { Button } from '@/fronted/components/ui/button';
import React, { useEffect } from 'react';
import { DpTask, DpTaskState } from '@/backend/db/tables/dpTask';
import useDpTask from '@/fronted/hooks/useDpTask';
import { m } from 'framer-motion';

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
            <TableCell className="font-medium">{file}</TableCell>
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
