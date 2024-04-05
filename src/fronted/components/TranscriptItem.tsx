import FileT from '@/common/types/FileT';
import { TableCell, TableRow } from '@/fronted/components/ui/table';
import { cn } from '@/common/utils/Util';
import { Button } from '@/fronted/components/ui/button';
import React, { useEffect } from 'react';
import { DpTask, DpTaskState } from '@/backend/db/tables/dpTask';

export interface TranscriptItemProps {
    file: FileT;
    taskId: number | null;
    onStart: () => void;
    onDelete: () => void;
}

const api = window.electron;

const TranscriptItem = ({ file, taskId, onStart, onDelete }: TranscriptItemProps) => {


    console.log('itemTaskId', taskId);
    const [task, setTask] = React.useState<DpTask>(null);
    const [started, setStarted] = React.useState(false);
    useEffect(() => {
        if (!taskId) {
            return;
        }
        if ((task?.status ?? DpTaskState.INIT) === DpTaskState.DONE) {
            return;
        }
        console.log('taskinterval', taskId);
        const run = async () => {
            console.log('taskinterval', taskId);
            const task = await api.dpTaskDetail(taskId);
            setTask(task);
        };
        const interval = setInterval(run, 1000);
        run().then();
        return () => {
            clearInterval(interval);
        };
    }, [taskId, task?.status]);

    return (
        <TableRow>
            <TableCell className="font-medium">{file.fileName}</TableCell>
            <TableCell className={cn('')}>{task?.progress ?? '未开始'}</TableCell>
            <TableCell className={cn(' flex')}>
                <Button
                    onClick={() => {
                        onStart();
                        setStarted(true);
                    }}
                    disabled={(task?.status??DpTaskState.INIT) !== DpTaskState.INIT || (started && task === null)}
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
