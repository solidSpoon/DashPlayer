import { cn } from '@/fronted/lib/utils';
import React, { useCallback, useEffect, useRef } from 'react';
import RepairFileSelector from './components/RepairFileSelector';
import RepairFolderSelector from './components/RepairFolderSelector';
import RepairItem from './components/RepairItem';
import { Button } from '@/fronted/components/ui/button';
import { RepairGroup, RepairRecipe, RepairTask, RepairTaskState } from '@/common/contracts/playback-repair';
import MediaUtil from '@/common/utils/MediaUtil';
import Eb from '@/fronted/components/shared/common/Eb';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { repairApi } from './repairApi';
import PageHeader from '@/fronted/components/shared/common/PageHeader';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { Wrench } from 'lucide-react';
import useSWR from 'swr';
import { SWR_KEY } from '@/fronted/lib/swr-util';
import { probeAndRecordPlaybackCapability } from '@/fronted/features/player/repairPlayback';
import toast from 'react-hot-toast';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/fronted/components/ui/dropdown-menu';

const logger = getRendererLogger('RepairPage');

/** 有任务在跑或还在探测时的轮询间隔，用于把「修复中 / 待检查」及时换成最终状态。 */
const RUNNING_POLL_INTERVAL_MS = 2000;

/** 整组强制重做可选的配方。 */
const GROUP_FORCE_RECIPES: Array<{ recipe: RepairRecipe; labelKey: string }> = [
    { recipe: 'full-transcode', labelKey: 'fullTranscode' },
    { recipe: 'video-copy-audio-transcode', labelKey: 'videoCopyAudioTranscode' },
    { recipe: 'remux-copy', labelKey: 'remuxCopy' },
    { recipe: 'audio-transcode', labelKey: 'audioTranscode' },
];

/**
 * 判断某个配方是否适用于这个文件。
 *
 * 纯音频只能转 AAC/M4A；视频可以用视频那三种做法（只保留音频会把画面丢掉，不提供）。
 *
 * @param file 媒体绝对路径。
 * @param recipe 配方。
 * @returns 适用时返回 true。
 */
const isRecipeApplicable = (file: string, recipe: RepairRecipe): boolean =>
    MediaUtil.isAudio(file) === (recipe === 'audio-transcode');

/** 判断记录是否还在修复。 */
const isRunning = (task: RepairTask): boolean => task.status === RepairTaskState.IN_PROGRESS;

/** 判断记录是否还没探测出结论。 */
const isPendingProbe = (task: RepairTask): boolean => task.status === RepairTaskState.INIT;

/**
 * 探测一条记录：先让后端按结构判定，再对「看起来能播」的文件做一次本机真机试播。
 *
 * 真机试播按编码组合去重：同一套编码在本机只需验证一次，后端会把结论写进学习缓存，
 * 因此文件夹里同编码的其它文件不会再试播。结论被推翻时重新探测一次，让记录跟着更新。
 *
 * @param file 媒体绝对路径。
 */
const probeTask = async (file: string): Promise<void> => {
    const diagnosis = await repairApi.probe(file);
    if (diagnosis.reason !== 'playable') {
        return;
    }
    const learned = await probeAndRecordPlaybackCapability(diagnosis);
    if (learned !== null) {
        await repairApi.probe(file);
    }
};

/**
 * 展示播放修复名单，并组织文件、文件夹的加入、整批探测与批量修复。
 *
 * 名单来自后端的「记录 + 组标记」两张表：记录是文件级的（状态只有一份），组只是标记，
 * 因此同一个文件出现在多个组时会同步显示同一条状态，播放页发起的修复也会出现在这里。
 * 一条记录探测出结论之前，它所在的组不允许开始修复，避免"边探边修"。
 */
const RepairPage = () => {
    const { t } = useI18nTranslation('pages');
    const { data: groups = [], error, mutate } = useSWR(
        SWR_KEY.REPAIR_GROUPS,
        repairApi.listGroups,
        {
            refreshInterval: (latest) => (latest ?? []).some((group) => group.tasks.some(
                (task) => isRunning(task) || isPendingProbe(task),
            )) ? RUNNING_POLL_INTERVAL_MS : 0,
        },
    );
    if (error) {
        throw error;
    }

    /** 正在探测的文件，避免同一文件被并发探测。 */
    const probingRef = useRef(new Set<string>());
    /** 页面卸载后停止探测循环。 */
    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const pendingFiles = [...new Set(
        groups.flatMap((group) => group.tasks.filter(isPendingProbe).map((task) => task.file)),
    )];
    const pendingKey = pendingFiles.join('|');

    // 顺序探测所有「待检查」的记录；离开页面会停在当前位置，回来接着探没探完的。
    useEffect(() => {
        const targets = pendingFiles.filter((file) => !probingRef.current.has(file));
        if (targets.length === 0) {
            return;
        }
        void (async () => {
            for (const file of targets) {
                if (!mountedRef.current) {
                    return;
                }
                probingRef.current.add(file);
                try {
                    await probeTask(file);
                } catch (probeError) {
                    logger.error('probe repair task failed', {
                        file,
                        error: probeError instanceof Error ? probeError.message : String(probeError),
                    });
                } finally {
                    probingRef.current.delete(file);
                    if (mountedRef.current) {
                        await mutate();
                    }
                }
            }
        })();
        // 只在待探测集合变化时重启循环；mutate 每次探测后就地刷新列表。
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingKey]);

    /**
     * 把媒体加入修复名单并刷新列表。
     *
     * @param filePaths 媒体绝对路径列表。
     * @param group 分组来源信息；不传时按「手动添加」处理。
     */
    const enqueue = useCallback(async (
        filePaths: string[],
        group?: { source: 'folder' | 'files'; path?: string },
    ): Promise<void> => {
        if (filePaths.length === 0) {
            return;
        }
        const result = await repairApi.enqueueTasks({
            source: group?.source ?? 'files',
            path: group?.path,
            filePaths,
        });
        if (result.addedFiles.length === 0) {
            // 完全重复的选择：组标识相同、成员关系已存在，不新建卡片，只提示一句。
            toast(t('playbackRepair.group.duplicate'));
        }
        await mutate();
    }, [mutate, t]);

    /**
     * 修复单个媒体并刷新列表。
     *
     * @param file 媒体绝对路径。
     */
    const repair = async (file: string): Promise<void> => {
        const { diagnosis } = await repairApi.startRepair({ filePath: file });
        logger.debug('repair started', { file, reason: diagnosis.reason, recipe: diagnosis.recipe });
        await mutate();
    };

    /**
     * 强制修复：用户指定配方，跳过「需不需要修」的判断。
     *
     * 用于诊断判定「无需修复」，但用户认为文件仍有问题的场景（卡顿、音画不同步等）。
     *
     * @param file 媒体绝对路径。
     * @param recipe 用户选择的配方。
     */
    const forceRepair = async (file: string, recipe: RepairRecipe): Promise<void> => {
        const { diagnosis } = await repairApi.startRepair({ filePath: file, forceRecipe: recipe });
        logger.debug('forced repair started', { file, recipe: diagnosis.recipe });
        await mutate();
    };

    /**
     * 修复一组里所有「待修复」的记录。
     *
     * @param group 目标分组。
     */
    const repairGroup = async (group: RepairGroup): Promise<void> => {
        for (const task of group.tasks) {
            if (task.status !== RepairTaskState.TODO) {
                continue;
            }
            await repair(task.file);
        }
        await mutate();
    };

    /**
     * 整组强制重做：按用户选的配方走，只处理支持这个做法的文件。
     *
     * 配方与媒体类型天然有匹配关系（音频选不了「整片重编码」这类），所以这里不做静默跳过：
     * 跳过了多少个、为什么跳过，都在提示里说清楚。
     *
     * @param group 目标分组。
     * @param recipe 用户选择的配方。
     */
    const forceRepairGroup = async (group: RepairGroup, recipe: RepairRecipe): Promise<void> => {
        const applicable = group.tasks.filter((task) => isRecipeApplicable(task.file, recipe));
        const skipped = group.tasks.length - applicable.length;
        for (const task of applicable) {
            await repairApi.startRepair({ filePath: task.file, forceRecipe: recipe });
        }
        await mutate();
        if (skipped > 0) {
            toast(t('playbackRepair.forceAppliedPartial', { done: applicable.length, skipped }));
        } else {
            toast(t('playbackRepair.forceApplied', { count: applicable.length }));
        }
    };

    /**
     * 删除一组名单：先取消组内正在跑的任务，再删记录与组标记。
     *
     * @param group 目标分组。
     */
    const removeGroup = async (group: RepairGroup): Promise<void> => {
        for (const task of group.tasks) {
            if (isRunning(task) && task.taskId !== null) {
                await repairApi.cancelTask(task.taskId);
            }
        }
        if (group.key === '') {
            // 未归组的记录（例如从播放页发起）：逐条删除，没有组标记可删。
            for (const task of group.tasks) {
                await repairApi.removeTask(task.file);
            }
        } else {
            await repairApi.removeGroup(group.key);
        }
        await mutate();
    };

    /**
     * 删除单条记录；正在修复时改为取消该任务。
     *
     * @param task 目标记录。
     */
    const removeTask = async (task: RepairTask): Promise<void> => {
        if (isRunning(task) && task.taskId !== null) {
            await repairApi.cancelTask(task.taskId);
            await mutate();
            return;
        }
        await repairApi.removeTask(task.file);
        await mutate();
    };

    /**
     * 生成分组标题：文件夹来源用目录路径，手动添加用条数。
     *
     * @param group 分组。
     * @returns 标题文案。
     */
    const groupTitle = (group: RepairGroup): string => {
        if (group.key === '') {
            return t('playbackRepair.group.ungrouped');
        }
        if (group.source === 'folder' && group.path) {
            return group.path;
        }
        return t('playbackRepair.group.manual', { count: group.tasks.length });
    };

    /**
     * 生成分组状态摘要：还有待检查的就显示检查进度，否则显示需要修复的条数。
     *
     * @param group 分组。
     * @returns 摘要文案。
     */
    const groupSummary = (group: RepairGroup): string => {
        const pending = group.tasks.filter(isPendingProbe).length;
        if (pending > 0) {
            return t('playbackRepair.group.probing', {
                done: group.tasks.length - pending,
                total: group.tasks.length,
            });
        }
        const todo = group.tasks.filter((task) => task.status === RepairTaskState.TODO).length;
        const running = group.tasks.filter(isRunning).length;
        if (running > 0) {
            return t('playbackRepair.group.running', { count: running });
        }
        if (todo > 0) {
            return t('playbackRepair.group.todo', { count: todo });
        }
        return t('playbackRepair.group.settled');
    };

    const isEmpty = groups.length === 0;

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
                                    const folderList = await repairApi.listFolderVideos(fp);
                                    for (const folder of folderList) {
                                        await enqueue(folder.videos, {
                                            source: 'folder',
                                            path: folder.folder,
                                        });
                                    }
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
                            const probing = group.tasks.some(isPendingProbe);
                            const running = group.tasks.some(isRunning);
                            const repairable = group.tasks.some((task) => task.status === RepairTaskState.TODO);
                            return (
                                <Eb key={group.key || 'ungrouped'}>
                                    <div className="flex flex-col gap-3.5 border border-border/70 p-4 rounded-2xl bg-card shadow-2xs">
                                        <div className="flex items-center gap-2 pb-1 border-b border-border/40">
                                            <h2 className="text-xs font-semibold text-foreground truncate min-w-0 tracking-wide">
                                                {groupTitle(group)}
                                            </h2>
                                            <span className="text-[11px] text-muted-foreground shrink-0">
                                                {groupSummary(group)}
                                            </span>
                                            <div className="flex-1 min-w-0" />
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                                                onClick={() => void removeGroup(group)}
                                            >
                                                {running ? t('playbackRepair.cancel') : t('playbackRepair.delete')}
                                            </Button>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        disabled={probing || running || group.tasks.length === 0}
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 px-2.5 text-xs"
                                                    >
                                                        {t('playbackRepair.forceFix')}
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    {GROUP_FORCE_RECIPES.map((item) => (
                                                        <DropdownMenuItem
                                                            key={item.recipe}
                                                            onClick={() => void forceRepairGroup(group, item.recipe)}
                                                        >
                                                            {t(`playbackRepair.recipe.${item.labelKey}`)}
                                                        </DropdownMenuItem>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                            <Button
                                                disabled={probing || !repairable}
                                                size="sm"
                                                className="h-7 px-3 text-xs font-medium"
                                                title={t('playbackRepair.fixNeededHint')}
                                                onClick={() => void repairGroup(group)}
                                            >
                                                {probing ? t('playbackRepair.probing') : t('playbackRepair.fixNeeded')}
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
                                                        onForceRepair={(recipe) => void forceRepair(task.file, recipe)}
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
