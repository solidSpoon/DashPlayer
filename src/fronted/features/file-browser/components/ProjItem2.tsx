import { BrowserItemVariant, CtxMenu } from '@/fronted/features/file-browser/components/VideoItem2';
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
import MusicCard from '@/fronted/features/file-browser/components/music-card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/fronted/components/ui/dropdown-menu';
import { fileBrowserApi } from '@/fronted/features/file-browser/fileBrowserApi';
import useInView from '@/fronted/hooks/useInView';

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
            return await fileBrowserApi.getThumbnail(PathUtil.join(path, file), time);
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
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                // 仅处理容器自身的按键，避免拦截子按钮的 Enter/Space
                                if (e.currentTarget === e.target && (e.key === 'Enter' || e.key === ' ')) {
                                    e.preventDefault();
                                    void onClick?.();
                                }
                            }}
                            className={cn(
                                'group/file-item w-full flex items-center gap-3.5 rounded-xl border border-transparent bg-background/50 px-2.5 py-2 transition-all duration-150 hover:bg-muted/60',
                                variant === 'highlight' && 'border-primary/40 bg-primary/10 text-foreground ring-1 ring-primary/20 shadow-2xs hover:bg-primary/15',
                                variant === 'lowlight' && 'text-muted-foreground/90',
                                contextMenu && variant !== 'highlight' && 'border-border/70 bg-muted/60'
                            )}
                            onClick={async () => {
                                onClick?.();
                            }}
                        >
                            <TooltipTrigger asChild>
                                <div className="flex min-w-0 flex-1 items-center gap-3.5">
                                    <div className="relative aspect-video w-28 sm:w-32 flex-shrink-0 overflow-hidden rounded-lg border border-border/50 bg-muted/70 shadow-2xs">
                                        {isFolder ? (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-muted/80 to-muted/40 text-muted-foreground">
                                                <Folder className="h-7 w-7 stroke-[1.7] text-muted-foreground/80" />
                                            </div>
                                        ) : isAudio ? (
                                            <div className="absolute inset-0">
                                                <MusicCard fileName={v.fileName} />
                                            </div>
                                        ) : shouldLoadThumbnail ? (
                                            thumbnail ? (
                                                <img
                                                    src={UrlUtil.toUrl(thumbnail)}
                                                    alt={v.fileName}
                                                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-200 group-hover/file-item:scale-105"
                                                />
                                            ) : thumbnailLoading ? (
                                                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/70" />
                                                </div>
                                            ) : (
                                                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                                                    <FileVideo2 className="h-6 w-6 stroke-[1.5] text-muted-foreground/70" />
                                                </div>
                                            )
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                                                <FileAudio2 className="h-6 w-6 stroke-[1.5] text-muted-foreground/70" />
                                            </div>
                                        )}
                                        {!isFolder && !isAudio && v?.duration > 0 && (
                                            <div className="pointer-events-none absolute bottom-1 right-1 rounded-md bg-black/75 backdrop-blur-md px-1.5 py-0.5 text-[10px] font-medium text-white/95 shadow-2xs">
                                                {TimeUtil.secondToTimeStrCompact(v.duration)}
                                            </div>
                                        )}
                                        {progress > 0 && (
                                            <Progress
                                                className="pointer-events-none absolute bottom-0 left-0 h-0.5 w-full rounded-none bg-black/20"
                                                value={progress}
                                            />
                                        )}
                                    </div>
                                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                                        <div
                                            className={cn(
                                                'truncate text-xs font-semibold text-foreground/90 transition-colors group-hover/file-item:text-foreground',
                                                variant === 'highlight' && 'text-primary font-bold'
                                            )}
                                            title={isFolder ? PathUtil.parse(v.basePath).base : (v.displayFileName ?? v.fileName)}
                                        >
                                            {isFolder ? PathUtil.parse(v.basePath).base : (v.displayFileName ?? v.fileName)}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                                            {v?.updatedAt && (
                                                <span>{TimeUtil.dateToRelativeTime(v.updatedAt)}</span>
                                            )}
                                            {!isFolder && v?.duration > 0 && (
                                                <>
                                                    <span className="text-muted-foreground/40">•</span>
                                                    <span>
                                                        {TimeUtil.secondToTimeStrCompact(v.current_position ?? 0)} / {TimeUtil.secondToTimeStrCompact(v.duration)}
                                                    </span>
                                                </>
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
                                                    className="h-7 w-7 rounded-lg text-muted-foreground opacity-60 transition-opacity hover:opacity-100 hover:bg-muted group-hover/file-item:opacity-100 shrink-0"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                    }}
                                                >
                                                    <EllipsisVertical className="h-3.5 w-3.5" />
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
