import {
    Table,
    TableBody,
    TableCaption,
    TableHead,
    TableHeader,
    TableRow
} from '@/fronted/components/ui/table';
import {cn} from "@/fronted/lib/utils";
import TranscriptItem from '@/fronted/components/TranscriptItem';
import React from 'react';
import useTranscript from '@/fronted/hooks/useTranscript';
import { useShallow } from 'zustand/react/shallow';
const TranscriptTable = () => {
    const {files,onDelFromQueue,onTranscript} = useTranscript(useShallow(s => ({
        files: s.files,
        onDelFromQueue: s.onDelFromQueue,
        onTranscript: s.onTranscript
    })));
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
                        key={f.file}
                        file={f.file}
                        taskId={f.taskId}
                        onStart={() => {
                            onTranscript(f.file);
                        }}
                        onDelete={() => {
                            onDelFromQueue(f.file);
                        }}/>
                ))}
            </TableBody>
        </Table>
    )
}
export default TranscriptTable;
