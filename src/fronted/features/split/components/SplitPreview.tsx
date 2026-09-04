import { cn } from '@/fronted/lib/utils';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/fronted/components/ui/table';
import React from 'react';
import useSplit, { TaskChapterParseResult } from '../splitStore';
import Eb from '@/fronted/components/shared/common/Eb';
import StrUtil from '@/common/utils/str-util';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import TimeUtil from '@/common/utils/TimeUtil';
import { timeTextToSeconds } from '@/common/utils/subtitle';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { useTranslation as useI18nTranslation } from 'react-i18next';

const logger = getRendererLogger('SplitRow');

/**
 * 切分结果预览表。
 * 当标题较长或窗口较窄时，优先在表格内部换行/滚动，避免把父布局撑宽。
 */
const SplitRow = ({ line, shortDurationLabel }: { line: TaskChapterParseResult; shortDurationLabel: string }) => {
    logger.debug('Rendering split row', {
        timestampStart: line.timestampStart,
        timestampEnd: line.timestampEnd,
        title: line.title,
        isValid: line.timestampValid
    });
    const valid = (timeTextToSeconds(line.timestampEnd) - timeTextToSeconds(line.timestampStart)) > 60;
    return (
        <TableRow className="border-b border-border/40 hover:bg-muted/40 transition-colors">
            <TableCell
                className={cn(
                    'font-mono text-xs py-2 px-3 w-28 text-muted-foreground',
                    !line.timestampValid && 'bg-destructive/10 text-destructive font-medium'
                )}
            >
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger className="hover:underline">{line.timestampStart}</TooltipTrigger>
                        <TooltipContent>
                            {valid ? TimeUtil.timeStrToChinese(line.timestampStart) : shortDurationLabel}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </TableCell>
            <TableCell
                className={cn(
                    'font-mono text-xs py-2 px-3 w-28 text-muted-foreground',
                    !line.timestampValid && 'bg-destructive/10 text-destructive font-medium'
                )}
            >
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger className="hover:underline">{line.timestampEnd}</TooltipTrigger>
                        <TooltipContent>
                            {valid ? TimeUtil.timeStrToChinese(line.timestampEnd) : shortDurationLabel}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </TableCell>
            <TableCell
                className={cn(
                    'text-xs py-2 px-3 break-words whitespace-normal font-medium text-foreground',
                    StrUtil.isBlank(line.title) && 'bg-destructive/10 text-destructive italic'
                )}
            >
                {line.title || '(未命名字段)'}
            </TableCell>
        </TableRow>
    );
};

/**
 * 展示切分结果的预览内容。
 * 负责在无数据时展示空态，在有数据时展示可横向滚动的表格。
 */
const SplitPreview = ({ className }: {
    className?: string;
}) => {
    const { t } = useI18nTranslation('pages');
    const lines = useSplit(s => s.parseResult);

    if (lines.length === 0) {
        return (
            <div className={cn('flex flex-col items-center justify-center py-20 text-center text-muted-foreground', className)}>
                <p className="text-xs leading-relaxed max-w-xs">{t('sentenceSplitter.preview.empty')}</p>
            </div>
        );
    }

    return (
        <Table className={cn('min-w-0 w-full table-fixed select-text', className)}>
            <TableHeader className="sticky top-0 bg-muted/40 backdrop-blur-xs z-10 border-b border-border/50">
                <TableRow className="hover:bg-transparent">
                    <TableHead className="w-28 text-xs font-semibold py-2 px-3">{t('sentenceSplitter.preview.startTime')}</TableHead>
                    <TableHead className="w-28 text-xs font-semibold py-2 px-3">{t('sentenceSplitter.preview.endTime')}</TableHead>
                    <TableHead className="text-xs font-semibold py-2 px-3">{t('sentenceSplitter.preview.title')}</TableHead>
                </TableRow>
            </TableHeader>
            <Eb>
                <TableBody className="scrollbar-none">
                    {lines.map((line, idx) => (
                        <SplitRow
                            key={idx}
                            line={line}
                            shortDurationLabel={t('sentenceSplitter.preview.shortDuration')}
                        />
                    ))}
                </TableBody>
            </Eb>
        </Table>
    );
};

SplitPreview.defaultProps = {
    className: ''
};

export default SplitPreview;
