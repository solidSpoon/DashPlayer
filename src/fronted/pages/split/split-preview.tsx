import {cn} from "@/fronted/lib/utils";
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/fronted/components/ui/table";
import React from "react";
import {Button} from "@/fronted/components/ui/button";
import useSplit, {TaskChapterParseResult} from "@/fronted/hooks/useSplit";
import useDpTaskViewer from "@/fronted/hooks/useDpTaskViewer";

const SplitRow = ({line}: { line: TaskChapterParseResult }) => {
    return (
        <TableRow>
            <TableCell
                className={cn(
                    'font-mono',
                    !line.timestampStart.valid && 'text-red-500',
                    !line.timestampValid && 'bg-red-100'
                )}
            >{line.timestampStart.value}</TableCell>
            <TableCell
                className={cn(
                    'font-mono',
                    !line.timestampStart.valid && 'text-red-500',
                    !line.timestampValid && 'bg-red-100'
                )}>{line.timestampEnd.value}</TableCell>
            <TableCell>{line.title}</TableCell>
        </TableRow>
    )
}

const SplitPreview = ({className}: {
    className?: string;
}) => {
    const lines = useSplit(s => s.parseResult);
    return (
        <Table className={cn('w-full', className)}>
            <TableCaption>A list of your recent invoices.</TableCaption>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-24">开始时间</TableHead>
                    <TableHead className={'w-24'}>结束时间</TableHead>
                    <TableHead className={''}>标题</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody
                className={'scrollbar-none'}
            >
                {lines.map((line, idx) => {
                    return (
                        <SplitRow key={idx} line={line}/>
                    );
                })}
            </TableBody>
        </Table>
    );
}

SplitPreview.defaultProps = {
    className: ''
}

export default SplitPreview;
