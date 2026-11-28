import { Button } from '@/fronted/components/ui/button';
import { cn } from '@/fronted/lib/utils';
import TranscriptItem from './TranscriptItem';
import React from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { type TranscriptTask, TranscriptTaskState } from '@/common/contracts/transcript/transcript-task';
import { Layers, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

/** 转录任务列表属性。 */
export interface TranscriptTableProps {
    /** 后端返回的全部转录任务。 */
    tasks: TranscriptTask[];
    /** 启动指定任务。 */
    onStart: (filePath: string) => Promise<'started' | 'model_missing'>;
    /** 删除指定任务。 */
    onDelete: (filePath: string) => Promise<void>;
    /** 清空所有非运行中的任务。 */
    onClear: () => Promise<void>;
}

/** 展示后端持久化的转录任务列表。 */
const TranscriptTable = ({ tasks, onStart, onDelete, onClear }: TranscriptTableProps) => {
    const { t } = useI18nTranslation('pages');
    const [clearing, setClearing] = React.useState(false);
    const [startingAll, setStartingAll] = React.useState(false);

    const pendingTasks = tasks.filter((task) => !task.status);
    const hasClearable = tasks.some(
        (task) => task.status !== TranscriptTaskState.INIT && task.status !== TranscriptTaskState.IN_PROGRESS
    );

    /**
     * 触发一键清空非活动任务，并在异常时提示错误。
     */
    const handleClear = async () => {
        if (!hasClearable || clearing) return;
        setClearing(true);
        try {
            await onClear();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : String(error));
        } finally {
            setClearing(false);
        }
    };

    /**
     * 批量启动队列中尚未开始的任务；若模型缺失则提示并中止剩余启动。
     */
    const handleStartAll = async () => {
        if (pendingTasks.length === 0 || startingAll) return;
        setStartingAll(true);
        try {
            for (const task of pendingTasks) {
                const result = await onStart(task.file);
                if (result === 'model_missing') {
                    toast.error(t('subtitleWorkspace.modelMissing'));
                    break;
                }
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : String(error));
        } finally {
            setStartingAll(false);
        }
    };

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
        <div className={cn('flex-1 min-h-0 flex flex-col')}>
            {/* 顶部队列工具栏：展示队列摘要与轻量级批量操作 */}
            <div className="flex items-center justify-between pl-1 pr-3 pb-2.5 select-none shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-semibold text-foreground/80">
                        {t('subtitleWorkspace.queueSectionTitle')}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
                        {t('subtitleWorkspace.queueSummary', { count: tasks.length })}
                    </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    {pendingTasks.length > 0 && (
                        <>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => void handleStartAll()}
                                disabled={startingAll}
                                className="h-7 px-2 text-xs font-medium text-foreground/80 hover:text-foreground hover:bg-muted/80 gap-1"
                            >
                                {startingAll && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                <span>{t('subtitleWorkspace.actions.startAll')}</span>
                            </Button>
                            <span className="h-3 w-px bg-border/70 mx-0.5" />
                        </>
                    )}
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleClear()}
                        disabled={!hasClearable || clearing}
                        className="h-7 px-2 text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1"
                    >
                        {clearing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        <span>{t('subtitleWorkspace.actions.clear')}</span>
                    </Button>
                </div>
            </div>

            {/* 任务卡片流滚动区 */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-thin flex flex-col gap-2.5 pr-1">
                {tasks.map((task) => (
                    <TranscriptItem
                        key={task.file}
                        task={task}
                        onStart={() => onStart(task.file)}
                        onDelete={() => onDelete(task.file)}
                    />
                ))}
            </div>
        </div>
    );
};
export default TranscriptTable;
