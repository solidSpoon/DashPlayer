import { cn } from '@/fronted/lib/utils';
import React from 'react';
import RepairFileSelector from './components/RepairFileSelector';
import RepairFolderSelector from './components/RepairFolderSelector';
import RepairItem from './components/RepairItem';
import { Button } from '@/fronted/components/ui/button';
import { RepairTask, RepairTaskState } from '@/common/contracts/playback-repair';
import Eb from '@/fronted/components/shared/common/Eb';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { repairApi } from './repairApi';
import PageHeader from '@/fronted/components/shared/common/PageHeader';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { Wrench } from 'lucide-react';
import useSWR from 'swr';
import { SWR_KEY } from '@/fronted/lib/swr-util';

const logger = getRendererLogger('RepairPage');

/** 正在修复时列表的轮询间隔，用于把「修复中」及时换成最终状态。 */
const RUNNING_POLL_INTERVAL_MS = 2000;

/** 按所在目录分组后的修复记录。 */
interface RepairGroup {
    /** 目录绝对路径。 */
    folder: string;
    /** 该目录下的修复记录。 */
    tasks: RepairTask[];
}

/**
 * 把修复记录按所在目录分组，保持入队顺序。
 *
 * @param tasks 全部修复记录。
 * @returns 分组结果。
 */
const groupByFolder = (tasks: RepairTask[]): RepairGroup[] => {
    const groups = new Map<string, RepairGroup>();
    for (const task of tasks) {
        const folder = task.file.replace(/[/\\][^/\\]*$/, '');
        const group = groups.get(folder) ?? { folder, tasks: [] };
        group.tasks.push(task);
        groups.set(folder, group);
    }
    return [...groups.values()];
};

/** 判断记录是否正在修复。 */
const isRunning = (task: RepairTask): boolean => task.status === RepairTaskState.IN_PROGRESS;

/**
 * 展示播放修复记录，并组织文件、文件夹的加入与批量修复。
 *
 * 列表直接读后端的修复记录表：从播放页发起的修复也写进同一张表，因此两个入口看到的是
 * 同一份进度，本页不再自己维护一份队列。记录只描述修复历史，产物是否存在、能不能播
 * 一律由播放链路按磁盘上的文件判断。
 */
const RepairPage = () => {
    const { t } = useI18nTranslation('pages');
    const { data: tasks = [], error, mutate } = useSWR(
        SWR_KEY.REPAIR_TASKS,
        repairApi.listTasks,
        { refreshInterval: (latest) => (latest ?? []).some(isRunning) ? RUNNING_POLL_INTERVAL_MS : 0 },
    );
    if (error) {
        throw error;
    }

    const groups = groupByFolder(tasks);
    const isEmpty = tasks.length === 0;

    /**
     * 把媒体加入修复名单并刷新列表。
     *
     * @param filePaths 媒体绝对路径列表。
     */
    const enqueue = async (filePaths: string[]): Promise<void> => {
        if (filePaths.length === 0) {
            return;
        }
        await repairApi.enqueueTasks(filePaths);
        await mutate();
    };

    /**
     * 修复单个媒体并刷新列表。
     *
     * @param file 媒体绝对路径。
     */
    const repair = async (file: string): Promise<void> => {
        const { diagnosis } = await repairApi.startRepair(file);
        logger.debug('repair started', { file, reason: diagnosis.reason, recipe: diagnosis.recipe });
        await mutate();
    };

    /**
     * 修复一组媒体中尚未完成的项。
     *
     * @param group 目标分组。
     */
    const repairGroup = async (group: RepairGroup): Promise<void> => {
        for (const task of group.tasks) {
            if (isRunning(task) || task.status === RepairTaskState.DONE) {
                continue;
            }
            await repair(task.file);
        }
        await mutate();
    };

    /**
     * 删除一组媒体的记录；有任务在跑时改为取消这些任务。
     *
     * @param group 目标分组。
     */
    const removeGroup = async (group: RepairGroup): Promise<void> => {
        for (const task of group.tasks) {
            if (isRunning(task) && task.taskId !== null) {
                await repairApi.cancelTask(task.taskId);
            }
        }
        for (const task of group.tasks) {
            await repairApi.removeTask(task.file);
        }
        await mutate();
    };

    /**
     * 删除单条记录；有任务在跑时改为取消该任务。
     *
     * @param task 目标记录。
     */
    const removeTask = async (task: RepairTask): Promise<void> => {
        if (isRunning(task) && task.taskId !== null) {
            await repairApi.cancelTask(task.taskId);
            return;
        }
        await repairApi.removeTask(task.file);
        await mutate();
    };

    return (
        <div className="w-full h-full flex flex-col overflow-hidden select-none bg-background text-foreground">
            {/* 顶栏标题区：无分割线 */}
            <div className="px-6 pt-5 pb-2">
                <PageHeader
                    title={t('playbackRepair.title')}
                    description={t('playbackRepair.description')}
                    rightSlot={
                        <div className="flex items-center gap-2.5 shrink-0">
                            <RepairFileSelector
                                onSelected={async (ps) => {
                                    await enqueue(ps);
                                }}
                            />
                            <RepairFolderSelector
                                onSelected={async (fp) => {
                                    const folderList = await repairApi.scanFolders(fp);
                                    await enqueue(folderList.flatMap((item) => item.videos));
                                }}
                            />
                        </div>
                    }
                />
            </div>

            <div className={cn(
                'flex-1 min-h-0 px-6 pb-5 pt-1',
                isEmpty
                    ? 'flex items-center justify-center'
                    : 'overflow-y-auto scrollbar-thin'
            )}>
                {isEmpty ? (
                    <div className="w-full max-w-lg mx-auto flex flex-col items-center justify-center p-10 text-center rounded-2xl border border-dashed border-border/70 bg-card/40 shadow-2xs">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground border border-border/60 mb-3 shadow-2xs">
                            <Wrench className="h-7 w-7 stroke-1 text-muted-foreground/80" />
                        </div>
                        <h3 className="text-sm font-medium text-foreground mb-1">
                            {t('playbackRepair.empty.title')}
                        </h3>
                        <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                            {t('playbackRepair.empty.guide')}
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {groups.map((group) => {
                            const running = group.tasks.some(isRunning);
                            const allDone = group.tasks.every((task) => isRunning(task)
                                || task.status === RepairTaskState.DONE);
                            return (
                                <Eb key={group.folder}>
                                    <div className="flex flex-col gap-3.5 border border-border/70 p-4 rounded-2xl bg-card shadow-2xs">
                                        <div className="flex items-center gap-2 pb-1 border-b border-border/40">
                                            <h2 className="text-xs font-semibold text-foreground truncate flex-1 min-w-0 tracking-wide">
                                                {group.folder}
                                            </h2>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                                                onClick={() => void removeGroup(group)}
                                            >
                                                {running ? t('playbackRepair.cancel') : t('playbackRepair.delete')}
                                            </Button>
                                            <Button
                                                disabled={allDone}
                                                size="sm"
                                                className="h-7 px-3 text-xs font-medium"
                                                onClick={() => void repairGroup(group)}
                                            >
                                                {t('playbackRepair.fix')}
                                            </Button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {group.tasks.map((task) => (
                                                <Eb key={task.file}>
                                                    <RepairItem
                                                        task={task}
                                                        buttonVariant="small"
                                                        className="border border-border/50 bg-muted/20 hover:bg-muted/35 transition-colors"
                                                        onRepair={() => void repair(task.file)}
                                                        onRemove={() => void removeTask(task)}
                                                    />
                                                </Eb>
                                            ))}
                                        </div>
                                    </div>
                                </Eb>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RepairPage;
