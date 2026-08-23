import {
    Table,
    TableBody,
} from '@/fronted/components/ui/table';
import { cn } from "@/fronted/lib/utils";
import TranscriptItem from './TranscriptItem';
import React from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { TranscriptTask } from '@/common/contracts/transcript/transcript-task';
import { Layers } from 'lucide-react';

/** 转录任务列表属性。 */
export interface TranscriptTableProps {
    /** 后端返回的全部转录任务。 */
    tasks: TranscriptTask[];
    /** 启动指定任务。 */
    onStart: (filePath: string) => Promise<'started' | 'model_missing'>;
    /** 删除指定任务。 */
    onDelete: (filePath: string) => Promise<void>;
}

/** 展示后端持久化的转录任务列表。 */
const TranscriptTable = ({ tasks, onStart, onDelete }: TranscriptTableProps) => {
    const { t } = useI18nTranslation('pages');

    if (tasks.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-dashed border-border/70 bg-card/40">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground border border-border/60 mb-3 shadow-2xs">
                    <Layers className="h-7 w-7 stroke-1 text-muted-foreground/80" />
                </div>
                <h3 className="text-sm font-medium text-foreground mb-1">
                    {t('subtitleWorkspace.table.empty')}
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
                    {t('subtitleWorkspace.table.emptyDesc')}
                </p>
            </div>
        );
    }

    return (
        <div className={cn('flex-1 rounded-2xl border border-border/70 bg-card shadow-2xs overflow-hidden flex flex-col [transform:translateZ(0)] isolate')}>
            {/* 顶层表头：独立于滚动区，彻底杜绝 sticky/backdrop-blur 造成的圆角遮挡 bug */}
            <div className="flex items-center px-4 py-3 border-b border-border/50 bg-muted/25 text-xs font-semibold text-muted-foreground select-none shrink-0">
                <div className="flex-1 min-w-0 pl-1">
                    {t('subtitleWorkspace.table.videoColumn')}
                </div>
                <div className="w-36 shrink-0 pl-2">
                    {t('subtitleWorkspace.table.statusColumn')}
                </div>
                <div className="w-36 shrink-0 text-right pr-2">
                    {t('subtitleWorkspace.table.actionColumn')}
                </div>
            </div>

            {/* 任务列表滚动区 */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-thin">
                <Table className="w-full table-fixed">
                    <TableBody>
                        {tasks.map((task) => (
                            <TranscriptItem
                                key={task.file}
                                task={task}
                                onStart={() => onStart(task.file)}
                                onDelete={() => onDelete(task.file)}
                            />
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};
export default TranscriptTable;
