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
import { ErrorBoundary } from 'react-error-boundary';
import FallBack from '@/fronted/components/shared/common/FallBack';
import StrUtil from '@/common/utils/str-util';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import TimeUtil from '@/common/utils/TimeUtil';
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
    const valid = (TimeUtil.parseDuration(line.timestampEnd) - TimeUtil.parseDuration(line.timestampStart)) > 60;
    return (
        <TableRow>
            <TableCell
                className={cn(
                    'font-mono text-xs',
                    !line.timestampValid && 'bg-red-100 dark:bg-red-950'
                )}
            >
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger>{line.timestampStart}</TooltipTrigger>
                        <TooltipContent>
                            {valid ? TimeUtil.timeStrToChinese(line.timestampStart) : shortDurationLabel}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </TableCell>
            <TableCell
                className={cn(
                    'font-mono text-xs',
                    !line.timestampValid && 'bg-red-100 dark:bg-red-950'
                )}
            >
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger>{line.timestampEnd}</TooltipTrigger>
                        <TooltipContent>
                            {valid ? TimeUtil.timeStrToChinese(line.timestampEnd) : shortDurationLabel}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </TableCell>
            <TableCell
                className={cn(
                    'text-sm break-words whitespace-normal',
                    StrUtil.isBlank(line.title) && 'bg-red-100 dark:bg-red-950'
                )}
            >{line.title}</TableCell>
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
            <div className={cn('flex items-center justify-center py-16 text-sm text-muted-foreground', className)}>
                {t('sentenceSplitter.preview.empty')}
            </div>
        );
    }

    return (
        <Table className={cn('min-w-0 w-full table-fixed', className)}>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-24">{t('sentenceSplitter.preview.startTime')}</TableHead>
                    <TableHead className="w-24">{t('sentenceSplitter.preview.endTime')}</TableHead>
                    <TableHead>{t('sentenceSplitter.preview.title')}</TableHead>
                </TableRow>
            </TableHeader>
            <ErrorBoundary fallback={<FallBack />}>
                <TableBody className="scrollbar-none">
                    {lines.map((line, idx) => (
                        <SplitRow
                            key={idx}
                            line={line}
                            shortDurationLabel={t('sentenceSplitter.preview.shortDuration')}
                        />
                    ))}
                </TableBody>
            </ErrorBoundary>
        </Table>
    );
};

SplitPreview.defaultProps = {
    className: ''
};

export default SplitPreview;
