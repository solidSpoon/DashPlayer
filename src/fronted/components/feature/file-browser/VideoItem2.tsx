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
import MusicCard from '@/fronted/components/feature/file-browser/music-card';
import { motion } from 'framer-motion';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';
import useInView from '@/fronted/hooks/useInView';

const api = backendClient;

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
        async ([_key, path, file, time]) => {
            return await api.call('split-video/thumbnail', { filePath: PathUtil.join(path, file), time });
        }
    );

    React.useEffect(() => {
        setThumbnailReady(false);
        setThumbnailError(false);
    }, [thumbnail]);

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
                                className={cn(
                                    'group/file-item w-full flex items-center gap-4 rounded-lg border border-transparent bg-background/60 px-3 py-2 transition-colors hover:bg-muted/70 dark:bg-muted/20 dark:hover:bg-muted/30',
                                    variant === 'highlight' && 'border-primary bg-primary/10 text-primary-foreground/90 hover:bg-primary/20',
                                    variant === 'lowlight' && 'text-muted-foreground',
                                    contextMenu && variant !== 'highlight' && 'border-border bg-muted/60 dark:bg-muted/40'
                                )}
                                onClick={() => {
                                    onClick?.();
                                }}
                            >
                                <div className="relative aspect-video w-32 flex-shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted">
                                    {isAudio ? (
                                        <div className="absolute inset-0">
                                            <MusicCard fileName={pv.fileName} />
                                        </div>
                                    ) : shouldLoadThumbnail ? (
                                        showThumbnail ? (
                                            <div className="absolute inset-0">
                                                {!thumbnailReady && (
                                                    <div className="absolute inset-0 bg-white pointer-events-none" />
                                                )}
                                                <motion.img
                                                    key={UrlUtil.toUrl(thumbnail)}
                                                    src={UrlUtil.toUrl(thumbnail)}
                                                    alt={pv.fileName}
                                                    className="absolute inset-0 h-full w-full object-cover"
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: thumbnailReady ? 1 : 0 }}
                                                    transition={{ duration: 0.3, ease: 'easeOut' }}
                                                    onLoad={() => {
                                                        setThumbnailReady(true);
                                                    }}
                                                    onError={() => {
                                                        setThumbnailError(true);
                                                    }}
                                                />
                                            </div>
                                        ) : thumbnailLoading ? (
                                            <div className="absolute inset-0 bg-white" />
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
                                    {!isAudio && pv?.duration > 0 && (
                                        <div className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[10px] text-white">
                                            {TimeUtil.secondToTimeStrCompact(pv.duration)}
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
                                        title={pv.displayFileName ?? pv.fileName}
                                    >
                                        {pv.displayFileName ?? pv.fileName}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                        {pv?.updatedAt && (
                                            <span>{TimeUtil.dateToRelativeTime(pv.updatedAt)}</span>
                                        )}
                                        {!isAudio && pv?.duration > 0 && (
                                            <span>
                                                {TimeUtil.secondToTimeStrCompact(pv.current_position ?? 0)} / {TimeUtil.secondToTimeStrCompact(pv.duration)}
                                            </span>
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
                                                        className="h-8 w-8"
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
