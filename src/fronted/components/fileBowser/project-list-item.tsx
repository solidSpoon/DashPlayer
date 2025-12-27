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
import MusicCard from '@/fronted/components/fileBowser/music-card';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';

const api = backendClient;

const ProjectListItem = ({ video, onSelected }: {
    video: WatchHistoryVO,
    className?: string,
    onSelected: () => void;
}) => {
    // 判断是否为 MP3 文件
    const isAudio = MediaUtil.isAudio(video.fileName);

    const { data: url } = useSWR(
        !isAudio ? [SWR_KEY.SPLIT_VIDEO_THUMBNAIL, video.basePath, video.fileName, video.current_position] : null,
        async ([key, path, file, time]) => {
            return await api.call('split-video/thumbnail', { filePath: PathUtil.join(path, file), time });
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
                    onMouseEnter={() => setHover(true)}
                    onMouseLeave={() => setHover(false)}
                    onClick={onSelected}
                    className={cn('flex gap-6  p-4 rounded-xl', (hover || contextMenu) && 'bg-muted')}>
                    <div className={cn('relative w-40 rounded-lg overflow-hidden')}>
                        {isAudio ? (
                            <MusicCard fileName={video.fileName}/>
                        ) : url ? (
                            <img
                                src={UrlUtil.file(url)}
                                style={{
                                    aspectRatio: '16/9'
                                }}
                                className="w-full object-cover"
                                alt={video.fileName}
                            />
                        ) : (
                            <div
                                style={{
                                    aspectRatio: '16/9'
                                }}
                                className={'w-full bg-gray-500 flex items-center justify-center'}>
                                <Film />
                            </div>
                        )}
                        <div
                            className={cn('absolute bottom-2 right-2 text-white bg-black bg-opacity-80 rounded-md p-1 py-0.5 text-xs flex')}>
                            {!video.isFolder ? TimeUtil.secondToTimeStrCompact(video?.duration) : <>
                                <ListVideo className={'w-4 h-4'} /></>}
                        </div>
                        <Progress
                            className={cn('absolute bottom-0 left-0 w-full rounded-none h-1 bg-gray-500')}
                            value={Math.floor((video?.current_position || 0) / (video?.duration || 1) * 100)}
                        />
                    </div>

                    <div className={'flex-1 w-0'}>
                        <div
                            className={' w-full line-clamp-2 break-words h-fit'}
                        >{video.displayFileName ?? video.fileName}</div>
                        <div className={'text-sm text-muted-foreground mt-2'}>
                            {TimeUtil.dateToRelativeTime(video?.updatedAt ?? new Date())}
                        </div>
                    </div>

                    <Button
                        className={cn('w-6 h-6 bg-background self-center', !hover && 'scale-0')}
                        size={'icon'}
                        variant={'outline'}
                        onClick={async (e) => {
                            e.stopPropagation();
                            await api.call('watch-history/group-delete', video.id);
                            await swrApiMutate('watch-history/list');
                        }}
                    >
                        <Trash2
                            className={'w-3 h-3'}
                        />
                    </Button>
                </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
                <ContextMenuItem
                    onClick={async () => {
                        await api.call('system/open-folder', video.basePath);
                    }}
                >Show In Explorer</ContextMenuItem>
                <ContextMenuItem
                    onClick={async () => {
                        await api.call('watch-history/group-delete', video.id);
                        await swrApiMutate('watch-history/list');
                    }}
                >Delete</ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
};

export default ProjectListItem;
