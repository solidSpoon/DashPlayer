import { cn } from '@/fronted/lib/utils';
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/fronted/components/ui/table';
import React from 'react';
import useSplit, { TaskChapterParseResult } from '@/fronted/hooks/useSplit';
import { ErrorBoundary } from 'react-error-boundary';
import FallBack from '@/fronted/components/shared/common/FallBack';
import StrUtil from '@/common/utils/str-util';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import TimeUtil from '@/common/utils/TimeUtil';
import { getRendererLogger } from '@/fronted/log/simple-logger';

const logger = getRendererLogger('SplitRow');

const SplitRow = ({ line }: { line: TaskChapterParseResult }) => {
    logger.debug('Rendering split row', { 
        timestampStart: line.timestampStart, 
        timestampEnd: line.timestampEnd, 
        title: line.title,
        isValid: line.timestampValid 
    });
    const valid = (TimeUtil.parseDuration(line.timestampEnd) - TimeUtil.parseDuration(line.timestampStart)) > 60;
    return (
        <TableRow>
            <TableCell
                className={cn(
                    'font-mono',
                    !line.timestampValid && 'bg-red-100'
                )}
            ><TooltipProvider>
                <Tooltip>
                    <TooltipTrigger>
                        {line.timestampStart}
                    </TooltipTrigger>
                    <TooltipContent>
                        {valid ? TimeUtil.timeStrToChinese(line.timestampStart) : '时间间隔小于1分钟'}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            </TableCell>
            <TableCell
                className={cn(
                    'font-mono',
                    !line.timestampValid && 'bg-red-100'
                )}><TooltipProvider>
                <Tooltip>
                    <TooltipTrigger>
                        {line.timestampEnd}
                    </TooltipTrigger>
                    <TooltipContent>
                        {valid ? TimeUtil.timeStrToChinese(line.timestampEnd) : '时间间隔小于1分钟'}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider></TableCell>
            <TableCell
                className={cn(StrUtil.isBlank(line.title) && 'bg-red-100')}
            >{line.title}</TableCell>
        </TableRow>
    );
};

const SplitPreview = ({ className }: {
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
            <ErrorBoundary fallback={<FallBack />}>
                <TableBody
                    className={'scrollbar-none'}
                >
                    {lines.map((line, idx) => {
                        return (
                            <SplitRow key={idx} line={line} />
                        );
                    })}
                </TableBody>
            </ErrorBoundary>
        </Table>
    );
};

SplitPreview.defaultProps = {
    className: ''
};

export default SplitPreview;
