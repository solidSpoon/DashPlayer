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
import MediaUtil from '@/common/utils/MediaUtil';
import { FileAudio2, FileVideo2 } from 'lucide-react';
import WatchHistoryVO from '@/common/types/WatchHistoryVO';
import PathUtil from '@/common/utils/PathUtil';
import { Button } from '@/fronted/components/ui/button';
import { Progress } from '@/fronted/components/ui/progress';
import TimeUtil from '@/common/utils/TimeUtil';
import UrlUtil from '@/common/utils/UrlUtil';
import { SWR_KEY } from '@/fronted/lib/swr-util';
import MusicCard from '@/fronted/features/file-browser/components/music-card';
import { motion } from 'framer-motion';
import { fileBrowserApi } from '@/fronted/features/file-browser/fileBrowserApi';
import useInView from '@/fronted/hooks/useInView';

export interface CtxMenu {
    icon: React.ReactNode;
    text: string;
    disabled?: boolean;
    onClick: () => void;
}

export type BrowserItemVariant = 'highlight' | 'normal' | 'lowlight';

const VideoItem2 = ({ pv, variant = 'normal', ctxMenus, onClick }: {
    pv: WatchHistoryVO,
    variant?: BrowserItemVariant;
    onClick?: () => void,
    ctxMenus: CtxMenu[]
}) => {
    const [contextMenu, setContextMenu] = React.useState(false);
    const [thumbnailReady, setThumbnailReady] = React.useState(false);
    const [thumbnailError, setThumbnailError] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const inView = useInView(containerRef);
    const isAudio = MediaUtil.isAudio(pv.fileName);
    const isVideo = MediaUtil.isVideo(pv.fileName);
    const shouldLoadThumbnail = !pv?.isFolder && isVideo;
    const { data: thumbnail, isLoading: thumbnailLoading } = useSWR(
        inView && shouldLoadThumbnail
            ? [SWR_KEY.SPLIT_VIDEO_THUMBNAIL, pv.basePath, pv.fileName, pv.current_position]
            : null,
        async ([_key, path, file, time]: [string, string, string, number]) => {
            return await fileBrowserApi.getThumbnail(PathUtil.join(path, file), time);
        }
    );

    // 缩略图路径变化时同步重置加载状态，避免 setTimeout 与 onLoad 的竞态导致图片透明
    const [lastThumbnail, setLastThumbnail] = React.useState(thumbnail);
    if (thumbnail !== lastThumbnail) {
        setLastThumbnail(thumbnail);
        setThumbnailReady(false);
        setThumbnailError(false);
    }

    const progress = pv?.duration ? Math.min(100, Math.floor(((pv?.current_position ?? 0) / pv.duration) * 100)) : 0;
    const actionButtons = ctxMenus?.length ? ctxMenus : [];
    const renderMenuIcon = (icon: React.ReactNode) => {
        if (React.isValidElement<{ className?: string }>(icon)) {
            return React.cloneElement(icon, {
                className: cn('h-4 w-4', icon.props.className)
            });
        }
        return icon;
    };
    const showThumbnail = Boolean(thumbnail) && !thumbnailError;
    return (
        <ContextMenu
            onOpenChange={(open) => {
                setContextMenu(open);
            }}
        >
            <ContextMenuTrigger>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div
                                ref={containerRef}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    // 仅处理容器自身的按键，避免拦截子按钮的 Enter/Space
                                    if (e.currentTarget === e.target && (e.key === 'Enter' || e.key === ' ')) {
                                        e.preventDefault();
                                        onClick?.();
                                    }
                                }}
                                className={cn(
                                    'group/file-item w-full flex items-center gap-3.5 rounded-xl border border-transparent bg-background/50 px-2.5 py-2 transition-all duration-150 hover:bg-muted/60',
                                    variant === 'highlight' && 'border-primary/40 bg-primary/10 text-foreground ring-1 ring-primary/20 shadow-2xs hover:bg-primary/15',
                                    variant === 'lowlight' && 'text-muted-foreground/90',
                                    contextMenu && variant !== 'highlight' && 'border-border/70 bg-muted/60'
                                )}
                                onClick={() => {
                                    onClick?.();
                                }}
                            >
                                <div className="relative aspect-video w-28 sm:w-32 flex-shrink-0 overflow-hidden rounded-lg border border-border/50 bg-muted/70 shadow-2xs">
                                    {isAudio ? (
                                        <div className="absolute inset-0">
                                            <MusicCard fileName={pv.fileName} />
                                        </div>
                                    ) : shouldLoadThumbnail ? (
                                        showThumbnail ? (
                                            <div className="absolute inset-0">
                                                {!thumbnailReady && (
                                                    <div className="absolute inset-0 bg-muted/50 pointer-events-none" />
                                                )}
                                                <motion.img
                                                    key={UrlUtil.toUrl(thumbnail ?? '')}
                                                    src={UrlUtil.toUrl(thumbnail ?? '')}
                                                    alt={pv.fileName}
                                                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-200 group-hover/file-item:scale-105"
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: thumbnailReady ? 1 : 0 }}
                                                    transition={{ duration: 0.25, ease: 'easeOut' }}
                                                    onLoad={() => {
                                                        setThumbnailReady(true);
                                                    }}
                                                    onError={() => {
                                                        setThumbnailError(true);
                                                    }}
                                                />
                                            </div>
                                        ) : thumbnailLoading ? (
                                            <div className="absolute inset-0 bg-muted/50" />
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
                                    {!isAudio && pv?.duration > 0 && (
                                        <div className="pointer-events-none absolute bottom-1 right-1 rounded-md bg-black/75 backdrop-blur-md px-1.5 py-0.5 text-[10px] font-medium text-white/95 shadow-2xs">
                                            {TimeUtil.secondToTimeStrCompact(pv.duration)}
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
                                        title={pv.displayFileName ?? pv.fileName}
                                    >
                                        {pv.displayFileName ?? pv.fileName}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                                        {pv?.updatedAt && (
                                            <span>{TimeUtil.dateToRelativeTime(pv.updatedAt)}</span>
                                        )}
                                        {!isAudio && pv?.duration > 0 && (
                                            <>
                                                <span className="text-muted-foreground/40">•</span>
                                                <span>
                                                    {TimeUtil.secondToTimeStrCompact(pv.current_position ?? 0)} / {TimeUtil.secondToTimeStrCompact(pv.duration)}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                {actionButtons.length > 0 && (
                                    <div className="flex flex-col items-end gap-1">
                                        {actionButtons.map((item, idx) => (
                                            <Tooltip key={idx}>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        disabled={item.disabled ?? false}
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            if (item.disabled) {
                                                                return;
                                                            }
                                                            await item.onClick();
                                                        }}
                                                        className="h-7 w-7 rounded-lg text-muted-foreground opacity-60 transition-opacity hover:opacity-100 hover:bg-muted group-hover/file-item:opacity-100"
                                                    >
                                                        {renderMenuIcon(item.icon)}
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent side="bottom">{item.text}</TooltipContent>
                                            </Tooltip>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </TooltipTrigger>
                        <TooltipContent
                            side={'bottom'}
                            align={'start'}
                        >
                            {PathUtil.join(pv.basePath, pv.fileName)}
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
                            <span className="text-muted-foreground">
                                {renderMenuIcon(item.icon)}
                            </span>
                            <span>{item.text}</span>
                        </div>
                    </ContextMenuItem>
                ))}
            </ContextMenuContent>
        </ContextMenu>

    );
};

export default VideoItem2;
