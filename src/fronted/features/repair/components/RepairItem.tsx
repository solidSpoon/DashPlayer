import useSWR from 'swr';
import { cn } from '@/fronted/lib/utils';
import React, { useState } from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { SWR_KEY } from '@/fronted/lib/swr-util';
import { Film, Music } from 'lucide-react';
import TimeUtil from '@/common/utils/TimeUtil';
import { Progress } from '@/fronted/components/ui/progress';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger
} from '@/fronted/components/ui/context-menu';
import { Button } from '@/fronted/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/fronted/components/ui/dropdown-menu';
import { RepairRecipe, RepairTask, RepairTaskState } from '@/common/contracts/playback-repair';
import useRepairEventStore from '@/fronted/features/repair/repairEvents';
import UrlUtil from '@/common/utils/UrlUtil';
import { repairApi } from '../repairApi';
import i18n from '@/fronted/i18n';
import MediaUtil from '@/common/utils/MediaUtil';

/** 各状态的配色：绿色表示没问题，琥珀表示要处理，红色表示失败。 */
const STATUS_STYLE: Record<string, string> = {
    init: 'bg-muted text-muted-foreground',
    todo: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    in_progress: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
    done: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    playable: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    cancelled: 'bg-muted text-muted-foreground',
    failed: 'bg-destructive/15 text-destructive',
    discarded: 'bg-muted text-muted-foreground/70',
};

/** 状态圆点颜色。 */
const STATUS_DOT: Record<string, string> = {
    init: 'bg-muted-foreground/50',
    todo: 'bg-amber-500',
    in_progress: 'bg-sky-500',
    done: 'bg-emerald-500',
    playable: 'bg-emerald-500',
    cancelled: 'bg-muted-foreground/50',
    failed: 'bg-destructive',
    discarded: 'bg-muted-foreground/40',
};

/**
 * 判断这条记录能不能就地预览播放：只有已经确认可播（或已修出产物）的才行。
 *
 * @param task 修复记录。
 * @returns 可以预览时返回待播放的路径。
 */
const previewSource = (task: RepairTask): string | null => {
    if (task.status !== RepairTaskState.DONE) {
        return null;
    }
    // 修过且有产物的，预览产物；本来就无需修复的，预览源文件。
    if (task.recipe && task.outputPath) {
        return task.outputPath;
    }
    return task.reason === 'playable' ? task.file : null;
};

/**
 * 展示一条修复记录：缩略图（悬停时就地静音预览）、状态、原因与操作按钮。
 *
 * 状态读记录表；正在修复时用修复事件的实时进度渲染进度条与百分比。
 */
const RepairItem = ({ task, className, buttonVariant, onRepair, onForceRepair, onRemove }: {
    task: RepairTask,
    className?: string,
    buttonVariant?: 'default' | 'small';
    onRepair: () => void;
    /** 指定配方强制重做；不想走自动配方的记录（已取消、失败、已丢弃、已判定无需修复）都可选用。 */
    onForceRepair: (recipe: RepairRecipe) => void;
    onRemove: () => void;
}) => {
    const { t } = useI18nTranslation('pages');
    const file = task.file;
    // 纯音频不请求缩略图（判定收口在 requestVideoThumbnail），这里只负责显示音符图标。
    const isAudio = MediaUtil.isAudio(file);
    const [hover, setHover] = useState(false);
    const { data: url } = useSWR(
        file ? [SWR_KEY.SPLIT_VIDEO_THUMBNAIL, file, 5] : null,
        async ([, path, time]) => {
            return await repairApi.getThumbnail(path, time);
        },
        // 记录可能指向已被改名或删除的文件，反复重试只会持续刷日志。
        { shouldRetryOnError: false }
    );
    const { data: videoLength } = useSWR(file ? ['duration', file] : null, async ([, f]) => {
        return await repairApi.getDuration(f);
    }, { revalidateOnFocus: false });
    // 实时进度来自修复事件缓存；还没收到事件（如刚刷新页面）时不显示百分比。
    const event = useRepairEventStore((state) => state.events.get(file));
    const progress = event?.progress ?? 0;

    const isProbing = task.status === RepairTaskState.INIT;
    // 已经得出结论的行（无需修复 / 已修复）不再走自动配方：重复点只会被判成「无需修复」，
    // 所以主按钮禁用，改由「强制修复」让用户自己选做法。
    const isSettled = task.status === RepairTaskState.DONE;
    const forceRecipes: Array<{ recipe: RepairRecipe; label: string }> = isAudio
        ? [{ recipe: 'audio-transcode', label: t('playbackRepair.recipe.audioTranscode') }]
        : [
            { recipe: 'remux-copy', label: t('playbackRepair.recipe.remuxCopy') },
            { recipe: 'video-copy-audio-transcode', label: t('playbackRepair.recipe.videoCopyAudioTranscode') },
            { recipe: 'full-transcode', label: t('playbackRepair.recipe.fullTranscode') },
        ];
    const isRunning = task.status === RepairTaskState.IN_PROGRESS
        || event?.status === RepairTaskState.IN_PROGRESS;
    // 强制修复入口对一切可发起修复的行开放：取消（含应用重启中断）、失败或丢弃之后，
    // 用户可能想换个配方重做，而不是重复刚才那条路径。
    const canForceRepair = !isRunning && !isProbing;
    const preview = previewSource(task);

    /**
     * 生成状态文案：完成态用诊断原因区分「已修复」与「本来就无需修复」。
     *
     * @returns 状态文案。
     */
    const statusText = (): string => {
        switch (task.status) {
            case RepairTaskState.INIT:
                return t('playbackRepair.status.init');
            case RepairTaskState.TODO:
                return t('playbackRepair.status.todo');
            case RepairTaskState.IN_PROGRESS:
                return t('playbackRepair.status.inProgress');
            case RepairTaskState.DONE:
                // 修过且有产物的算「已修复」；没跑过修复就说不用修的，算「无需修复」。
                return task.recipe || task.reason !== 'playable'
                    ? t('playbackRepair.status.done')
                    : t('playbackRepair.status.playable');
            case RepairTaskState.CANCELLED:
                return t('playbackRepair.status.cancelled');
            case RepairTaskState.FAILED:
                return t('playbackRepair.status.failed');
            case RepairTaskState.DISCARDED:
                return t('playbackRepair.status.discarded');
            default:
                return t('playbackRepair.status.init');
        }
    };

    /**
     * 取状态配色键：已完成的行按「无需修复 / 已修复」分开配色。
     *
     * @returns 配色键。
     */
    const statusKey = (): string => {
        if (task.status !== RepairTaskState.DONE) {
            return task.status ?? 'init';
        }
        if (isRunning) {
            return RepairTaskState.IN_PROGRESS;
        }
        return task.recipe || task.reason !== 'playable' ? 'done' : 'playable';
    };

    /**
     * 生成第二行说明：失败显示错误，取消显示原因（如「应用重启导致修复中断」），
     * 待修复显示原因，其余显示路径。
     *
     * @returns 说明文案。
     */
    const detailText = (): string => {
        if ((task.status === RepairTaskState.FAILED || task.status === RepairTaskState.CANCELLED) && task.error) {
            return task.error;
        }
        if (task.status === RepairTaskState.TODO && task.reason) {
            return t(`playbackRepair.reason.${task.reason}`);
        }
        return file;
    };

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <div
                    onMouseEnter={() => setHover(true)}
                    onMouseLeave={() => setHover(false)}
                    className={cn(
                        'group flex gap-4 p-3.5 relative rounded-xl overflow-hidden transition-all text-foreground select-none',
                        className
                    )}
                >
                    {/* 缩略图：已确认可播的媒体在悬停时就地静音预览 */}
                    <div className="relative w-36 sm:w-40 shrink-0 rounded-lg overflow-hidden bg-muted/60 border border-border/40 aspect-video flex items-center justify-center">
                        {hover && preview && !isAudio ? (
                            <video
                                className="w-full h-full object-cover pointer-events-none"
                                src={UrlUtil.toUrl(preview)}
                                muted
                                autoPlay
                                loop
                                playsInline
                            />
                        ) : url ? (
                            <img
                                src={UrlUtil.toUrl(url)}
                                className="w-full h-full object-cover"
                                alt={file}
                            />
                        ) : isAudio ? (
                            <Music className="w-6 h-6 text-muted-foreground/60" />
                        ) : (
                            <Film className="w-6 h-6 text-muted-foreground/60" />
                        )}
                        {videoLength !== undefined && (
                            <div className="absolute bottom-1.5 right-1.5 text-white bg-black/75 backdrop-blur-xs rounded px-1.5 py-0.5 text-[11px] font-mono leading-none">
                                {TimeUtil.secondToTimeStrCompact(videoLength)}
                            </div>
                        )}
                    </div>

                    {/* 文件名及操作区 */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                        <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-foreground line-clamp-2 break-all leading-snug" title={file}>
                                {file.split(/[/\\]/).pop() || file}
                            </span>
                            <span className="text-[11px] text-muted-foreground truncate" title={detailText()}>
                                {detailText()}
                            </span>
                        </div>

                        <div className="w-full flex items-center justify-between mt-2 pt-1">
                            {/* 状态与进度：绿色=没问题，琥珀=要处理，红色=失败 */}
                            <div
                                className={cn(
                                    'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium truncate max-w-[55%]',
                                    STATUS_STYLE[statusKey()] ?? STATUS_STYLE.init,
                                )}
                                title={statusText()}
                            >
                                <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', STATUS_DOT[statusKey()] ?? STATUS_DOT.init)} />
                                <span className="truncate">
                                    {isRunning && event?.status === RepairTaskState.IN_PROGRESS
                                        ? `${statusText()} ${Math.round(progress)}%`
                                        : statusText()}
                                </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                                {canForceRepair && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                onClick={(e) => e.stopPropagation()}
                                                className={cn(
                                                    buttonVariant === 'small' ? 'px-2 py-0 text-xs h-6.5' : 'h-7 px-2.5 text-xs'
                                                )}
                                                size="sm"
                                                variant="outline"
                                            >
                                                {t('playbackRepair.forceFix')}
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
                                            {forceRecipes.map((item) => (
                                                <DropdownMenuItem
                                                    key={item.recipe}
                                                    onClick={() => onForceRepair(item.recipe)}
                                                >
                                                    {item.label}
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                                <Button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRemove();
                                    }}
                                    className={cn(
                                        buttonVariant === 'small' ? 'px-2 py-0 text-xs h-6.5' : 'h-7 px-2.5 text-xs'
                                    )}
                                    size="sm"
                                    variant="ghost"
                                >
                                    {isRunning ? t('playbackRepair.cancel') : t('playbackRepair.delete')}
                                </Button>
                                <Button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRepair();
                                    }}
                                    disabled={isRunning || isProbing || isSettled}
                                    title={isSettled ? t('playbackRepair.fixDisabled') : undefined}
                                    className={cn(
                                        buttonVariant === 'small' ? 'px-2.5 py-0 text-xs h-6.5 font-medium' : 'h-7 px-3 text-xs font-medium'
                                    )}
                                    size="sm"
                                    variant={isRunning || isProbing ? 'secondary' : 'default'}
                                >
                                    {t('playbackRepair.fix')}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* 底部进度条 */}
                    {isRunning && (
                        <Progress
                            className="absolute bottom-0 left-0 w-full rounded-none h-1 bg-muted/40 [&>*]:transition-transform [&>*]:duration-500"
                            value={progress}
                        />
                    )}
                </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
                <ContextMenuItem
                    onClick={async () => {
                        await repairApi.openFolder(file);
                    }}
                >
                    {i18n.t('common:showInExplorer')}
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
};

export default RepairItem;
