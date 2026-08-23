import useSWR from 'swr';
import { cn } from '@/fronted/lib/utils';
import React from 'react';
import { SWR_KEY, swrApiMutate } from '@/fronted/lib/swr-util';
import { Button } from '@/fronted/components/ui/button';
import { Film, ListVideo, Trash2 } from 'lucide-react'; // 添加 Music 图标导入
import TimeUtil from '@/common/utils/TimeUtil';
import { Progress } from '@/fronted/components/ui/progress';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger
} from '@/fronted/components/ui/context-menu';
import UrlUtil from '@/common/utils/UrlUtil';
import WatchHistoryVO from '@/common/types/WatchHistoryVO';
import PathUtil from '@/common/utils/PathUtil';
import MediaUtil from '@/common/utils/MediaUtil';
import MusicCard from '@/fronted/features/file-browser/components/music-card';
import { fileBrowserApi } from '@/fronted/features/file-browser/fileBrowserApi';
import useInView from '@/fronted/hooks/useInView';
import i18n from '@/fronted/i18n';

const ProjectListItem = ({ video, onSelected }: {
    video: WatchHistoryVO,
    className?: string,
    onSelected: () => void;
}) => {
    // 判断是否为 MP3 文件
    const isAudio = MediaUtil.isAudio(video.fileName);
    const showDuration = !video.isFolder && video.duration > 0;
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const inView = useInView(containerRef);

    const { data: url } = useSWR(
        inView && !isAudio ? [SWR_KEY.SPLIT_VIDEO_THUMBNAIL, video.basePath, video.fileName, video.current_position] : null,
        async ([, path, file, time]) => {
            return await fileBrowserApi.getThumbnail(PathUtil.join(path, file), time);
        }
    );

    const [hover, setHover] = React.useState(false);
    const [contextMenu, setContextMenu] = React.useState(false);

    return (
        <ContextMenu
            onOpenChange={(open) => {
                setContextMenu(open);
            }}
        >
            <ContextMenuTrigger>
                <div
                    ref={containerRef}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        // 仅处理容器自身的按键，避免拦截子按钮的 Enter/Space
                        if (e.currentTarget === e.target && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            onSelected();
                        }
                    }}
                    onMouseEnter={() => setHover(true)}
                    onMouseLeave={() => setHover(false)}
                    onClick={onSelected}
                    className={cn(
                        'group flex items-center gap-4 py-3 px-2 rounded-2xl transition-all duration-150 cursor-pointer outline-none',
                        (hover || contextMenu) ? 'bg-muted/60' : 'hover:bg-muted/30'
                    )}>
                    <div className={cn('relative w-36 sm:w-44 shrink-0 rounded-xl overflow-hidden bg-muted/60 border border-border/50 shadow-2xs')}>
                        {isAudio ? (
                            <MusicCard fileName={video.fileName}/>
                        ) : url ? (
                            <img
                                src={UrlUtil.toUrl(url)}
                                style={{
                                    aspectRatio: '16/9'
                                }}
                                className="w-full object-cover transition-transform duration-200 group-hover:scale-105"
                                alt={video.fileName}
                            />
                        ) : (
                            <div
                                style={{
                                    aspectRatio: '16/9'
                                }}
                                className={'w-full bg-muted/80 flex items-center justify-center text-muted-foreground/60'}>
                                <Film className="w-6 h-6 stroke-1" />
                            </div>
                        )}
                        {(showDuration || video.isFolder) && (
                            <div
                                className={cn('absolute bottom-2 right-2 text-white/95 bg-black/75 backdrop-blur-md rounded-md px-1.5 py-0.5 text-[11px] font-medium flex items-center gap-1 shadow-2xs')}>
                                {!video.isFolder ? TimeUtil.secondToTimeStrCompact(video?.duration) : <>
                                    <ListVideo className={'w-3.5 h-3.5'} /></>}
                            </div>
                        )}
                        {showDuration && (
                            <Progress
                                className={cn('absolute bottom-0 left-0 w-full rounded-none h-1 bg-black/30')}
                                value={Math.floor((video?.current_position || 0) / (video?.duration || 1) * 100)}
                            />
                        )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                        <div className="text-sm font-medium text-foreground truncate group-hover:text-foreground/85 transition-colors" title={video.fileName}>
                            {video.displayFileName ?? video.fileName}
                        </div>
                        <div className="text-xs text-muted-foreground/80 truncate">
                            {TimeUtil.dateToRelativeTime(video?.updatedAt ?? new Date())}
                        </div>
                    </div>
                    {hover && (
                        <Button
                            className="w-8 h-8 rounded-xl shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            size="icon"
                            variant="ghost"
                            onClick={async (e) => {
                                e.stopPropagation();
                                await fileBrowserApi.deleteWatchHistoryGroup(video.id);
                                await swrApiMutate('watch-history/list');
                            }}
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
                <ContextMenuItem
                    onClick={async () => {
                        await fileBrowserApi.openFolder(video.basePath);
                    }}
                >{i18n.t('common:showInExplorer')}</ContextMenuItem>
                <ContextMenuItem
                    onClick={async () => {
                        await fileBrowserApi.deleteWatchHistoryGroup(video.id);
                        await swrApiMutate('watch-history/list');
                    }}
                >{i18n.t('common:delete')}</ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
};

export default ProjectListItem;
