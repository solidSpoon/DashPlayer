import useSWR from 'swr';
import { cn } from '@/fronted/lib/utils';
import React from 'react';
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
import { RepairTask, RepairTaskResult, RepairTaskState } from '@/common/contracts/playback-repair';
import { DpTaskState } from '@/common/contracts/dp-task';
import useDpTaskViewer from '@/fronted/hooks/useDpTaskViewer';
import StrUtil from '@/common/utils/str-util';
import UrlUtil from '@/common/utils/UrlUtil';
import { repairApi } from '../repairApi';
import i18n from '@/fronted/i18n';
import MediaUtil from '@/common/utils/MediaUtil';

/**
 * 展示一条修复记录：缩略图、时长、状态与操作按钮。
 *
 * 状态读记录表；正在修复时用后台任务的实时进度渲染进度条与百分比。
 */
const RepairItem = ({ task, className, buttonVariant, onRepair, onRemove }: {
    task: RepairTask,
    className?: string,
    buttonVariant?: 'default' | 'small';
    onRepair: () => void;
    onRemove: () => void;
}) => {
    const { t } = useI18nTranslation('pages');
    const file = task.file;
    // 纯音频不请求缩略图（判定收口在 requestVideoThumbnail），这里只负责显示音符图标。
    const isAudio = MediaUtil.isAudio(file);
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
    const { task: dpTask } = useDpTaskViewer(task.taskId);
    const resultJson = dpTask?.result;
    const progress = StrUtil.isNotBlank(resultJson) ? JSON.parse(resultJson) : {
        progress: 0,
        path: file
    } as RepairTaskResult;

    const isRunning = task.status === RepairTaskState.IN_PROGRESS
        || dpTask?.status === DpTaskState.IN_PROGRESS;

    /**
     * 生成状态文案：完成态用诊断原因区分「已修复」与「本来就无需修复」。
     *
     * @returns 状态文案。
     */
    const statusText = (): string => {
        switch (task.status) {
            case RepairTaskState.IN_PROGRESS:
                return t('playbackRepair.status.inProgress');
            case RepairTaskState.DONE:
                return task.reason === 'playable'
                    ? t('playbackRepair.status.playable')
                    : t('playbackRepair.status.done');
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

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <div
                    className={cn(
                        'group flex gap-4 p-3.5 relative rounded-xl overflow-hidden transition-all text-foreground select-none',
                        className
                    )}
                >
                    {/* 视频缩略图 */}
                    <div className="relative w-36 sm:w-40 shrink-0 rounded-lg overflow-hidden bg-muted/60 border border-border/40 aspect-video flex items-center justify-center">
                        {url ? (
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
                            <span className="text-[11px] text-muted-foreground truncate" title={task.error ?? file}>
                                {task.error ?? file}
                            </span>
                        </div>

                        <div className="w-full flex items-center justify-between mt-2 pt-1">
                            {/* 状态与进度 */}
                            <div className="text-[11px] font-mono text-muted-foreground truncate" title={statusText()}>
                                {isRunning && progress.progress !== undefined
                                    ? `${statusText()} ${Math.round(progress.progress)}%`
                                    : statusText()}
                            </div>

                            <div className="flex items-center gap-1.5">
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
                                    disabled={isRunning}
                                    className={cn(
                                        buttonVariant === 'small' ? 'px-2.5 py-0 text-xs h-6.5 font-medium' : 'h-7 px-3 text-xs font-medium'
                                    )}
                                    size="sm"
                                    variant={isRunning ? 'secondary' : 'default'}
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
                            value={progress.progress}
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
