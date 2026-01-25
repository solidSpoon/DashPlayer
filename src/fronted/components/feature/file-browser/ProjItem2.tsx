import { BrowserItemVariant, CtxMenu } from '@/fronted/components/feature/file-browser/VideoItem2';
import React from 'react';
import useSWR from 'swr';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger
} from '@/fronted/components/ui/context-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import { cn } from '@/fronted/lib/utils';
import { EllipsisVertical, FileAudio2, FileVideo2, Folder, Loader2 } from 'lucide-react';
import MediaUtil from '@/common/utils/MediaUtil';
import { Button } from '@/fronted/components/ui/button';
import WatchHistoryVO from '@/common/types/WatchHistoryVO';
import PathUtil from '@/common/utils/PathUtil';
import TimeUtil from '@/common/utils/TimeUtil';
import { Progress } from '@/fronted/components/ui/progress';
import UrlUtil from '@/common/utils/UrlUtil';
import { SWR_KEY } from '@/fronted/lib/swr-util';
import MusicCard from '@/fronted/components/feature/file-browser/music-card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/fronted/components/ui/dropdown-menu';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';
import useInView from '@/fronted/hooks/useInView';

const api = backendClient;
const ProjItem2 = ({ v, onClick, ctxMenus, variant = 'normal' }: {
    v: WatchHistoryVO;
    variant?: BrowserItemVariant;
    onClick?: () => void,
    ctxMenus: CtxMenu[]
}) => {
    const [contextMenu, setContextMenu] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const inView = useInView(containerRef);
    const isFolder = v.isFolder;
    const isAudio = !isFolder && MediaUtil.isAudio(v?.fileName);
    const isVideo = !isFolder && MediaUtil.isVideo(v?.fileName);
    const shouldLoadThumbnail = isVideo;
    const { data: thumbnail, isLoading: thumbnailLoading } = useSWR(
        inView && shouldLoadThumbnail
            ? [SWR_KEY.SPLIT_VIDEO_THUMBNAIL, v.basePath, v.fileName, v.current_position]
            : null,
        async ([_key, path, file, time]) => {
            return await api.call('split-video/thumbnail', { filePath: PathUtil.join(path, file), time });
        }
    );
    const progress = !isFolder && v?.duration
        ? Math.min(100, Math.floor(((v?.current_position ?? 0) / v.duration) * 100))
        : 0;
    const renderMenuIcon = (icon: React.ReactNode) => {
        if (React.isValidElement<{ className?: string }>(icon)) {
            return React.cloneElement(icon, {
                className: cn('h-4 w-4', icon.props.className)
            });
        }
        return icon;
    };
    return (
        <ContextMenu
            onOpenChange={(open) => {
                setContextMenu(open);
            }}
        >
            <ContextMenuTrigger>
                <TooltipProvider>
                    <Tooltip>
                        <div
                            ref={containerRef}
                            className={cn(
                                'group/file-item w-full flex items-center gap-4 rounded-lg border border-transparent bg-background/60 px-3 py-2 transition-colors hover:bg-muted/70 dark:bg-muted/20 dark:hover:bg-muted/30',
                                variant === 'highlight' && 'border-primary bg-primary/10 text-primary-foreground/90 hover:bg-primary/20',
                                variant === 'lowlight' && 'text-muted-foreground',
                                contextMenu && variant !== 'highlight' && 'border-border bg-muted/60 dark:bg-muted/40'
                            )}
                            onClick={async () => {
                                onClick?.();
                            }}
                        >
                            <TooltipTrigger asChild>
                                <div className="flex min-w-0 flex-1 items-center gap-4">
                                    <div className="relative aspect-video w-32 flex-shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted">
                                        {isFolder ? (
                                            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                                                <Folder className="h-8 w-8" />
                                            </div>
                                        ) : isAudio ? (
                                            <div className="absolute inset-0">
                                                <MusicCard fileName={v.fileName} />
                                            </div>
                                        ) : shouldLoadThumbnail ? (
                                            thumbnail ? (
                                                <img
                                                    src={UrlUtil.file(thumbnail)}
                                                    alt={v.fileName}
                                                    className="absolute inset-0 h-full w-full object-cover"
                                                />
                                            ) : thumbnailLoading ? (
                                                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                                                    <Loader2 className="h-5 w-5 animate-spin" />
                                                </div>
                                            ) : (
                                                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                                                    <FileVideo2 className="h-6 w-6" />
                                                </div>
                                            )
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                                                <FileAudio2 className="h-6 w-6" />
                                            </div>
                                        )}
                                        {!isFolder && !isAudio && v?.duration > 0 && (
                                            <div className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[10px] text-white">
                                                {TimeUtil.secondToTimeStrCompact(v.duration)}
                                            </div>
                                        )}
                                        {progress > 0 && (
                                            <Progress
                                                className="pointer-events-none absolute bottom-0 left-0 h-1 w-full rounded-none"
                                                value={progress}
                                            />
                                        )}
                                    </div>
                                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                                        <div
                                            className="truncate text-sm font-medium"
                                            title={isFolder ? PathUtil.parse(v.basePath).base : (v.displayFileName ?? v.fileName)}
                                        >
                                            {isFolder ? PathUtil.parse(v.basePath).base : (v.displayFileName ?? v.fileName)}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                            {v?.updatedAt && (
                                                <span>{TimeUtil.dateToRelativeTime(v.updatedAt)}</span>
                                            )}
                                            {!isFolder && v?.duration > 0 && (
                                                <span>
                                                    {TimeUtil.secondToTimeStrCompact(v.current_position ?? 0)} / {TimeUtil.secondToTimeStrCompact(v.duration)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </TooltipTrigger>
                            {ctxMenus?.length > 0 && (
                                <DropdownMenu>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-8 w-8"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                    }}
                                                >
                                                    <EllipsisVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom">更多操作</TooltipContent>
                                    </Tooltip>
                                    <DropdownMenuContent
                                        align="end"
                                        onClick={(event) => event.stopPropagation()}
                                    >
                                        {ctxMenus.map((item, idx) => (
                                            <DropdownMenuItem
                                                key={idx}
                                                disabled={item.disabled ?? false}
                                                onClick={async (event) => {
                                                    event.stopPropagation();
                                                    if (item.disabled) {
                                                        return;
                                                    }
                                                    await item.onClick();
                                                }}
                                                className="cursor-pointer"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="text-muted-foreground">{renderMenuIcon(item.icon)}</span>
                                                    <span>{item.text}</span>
                                                </div>
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>
                        <TooltipContent
                            side={'bottom'}
                            align={'start'}
                        >
                            {v.displayFileName ?? v.fileName}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </ContextMenuTrigger>
            <ContextMenuContent>
                {ctxMenus.map((item, idx) => (
                    <ContextMenuItem
                        disabled={item.disabled ?? false}
                        key={idx}
                        onClick={async () => {
                            if (item.disabled) {
                                return;
                            }
                            await item.onClick();
                        }}
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">{renderMenuIcon(item.icon)}</span>
                            <span>{item.text}</span>
                        </div>
                    </ContextMenuItem>
                ))}
            </ContextMenuContent>
        </ContextMenu>
    );
};
export default ProjItem2;
