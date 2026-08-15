import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow
} from '@/fronted/components/ui/table';
import { cn } from "@/fronted/lib/utils";
import TranscriptItem from './TranscriptItem';
import React from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { TranscriptTask } from '@/common/contracts/transcript/transcript-task';

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
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground rounded-lg border bg-muted/20">
                {t('subtitleWorkspace.table.empty')}
            </div>
        );
    }

    return (
        <div className={cn('flex-1 overflow-auto scrollbar-thin rounded-lg border bg-muted/20')}>
            <Table className="w-full">
                <TableHeader>
                    <TableRow>
                        <TableHead>{t('subtitleWorkspace.table.videoColumn')}</TableHead>
                        <TableHead className="w-40">{t('subtitleWorkspace.table.statusColumn')}</TableHead>
                        <TableHead className="w-36">{t('subtitleWorkspace.table.actionColumn')}</TableHead>
                    </TableRow>
                </TableHeader>
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
    );
};
export default TranscriptTable;
