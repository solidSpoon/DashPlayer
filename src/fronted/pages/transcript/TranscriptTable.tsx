import {
    Table,
    TableBody,
    TableCaption,
    TableHead,
    TableHeader,
    TableRow
} from '@/fronted/components/ui/table';
import { cn } from '@/common/utils/Util';
import TranscriptItem from '@/fronted/components/TranscriptItem';
import React from 'react';
export interface TranscriptTask {
    file: string;
    taskId: number | null;
}
const TranscriptTable = ({files, onTranscript, onDelete}:{
    files:TranscriptTask[],
    onTranscript:(file:TranscriptTask)=>void,
    onDelete:(file:TranscriptTask)=>void
}) => {
    return(
        <Table className={cn('h-0 w-full flex-1')}>
            <TableCaption>A list of your recent invoices.</TableCaption>
            <TableHeader>
                <TableRow>
                    <TableHead className="">视频</TableHead>
                    <TableHead className={'w-40'}>状态</TableHead>
                    <TableHead className={'w-36'}>操作</TableHead>
                    {/* <TableHead className="text-right">Amount</TableHead> */}
                </TableRow>
            </TableHeader>
            <TableBody>
                {files.map((f) => (
                    <TranscriptItem
                        file={f.file}
                        taskId={f.taskId}
                        onStart={() => {
                            onTranscript(f);
                        }}
                        onDelete={() => {
                            onDelete(f);
                        }}/>
                ))}
            </TableBody>
        </Table>
    )
}
export default TranscriptTable;
