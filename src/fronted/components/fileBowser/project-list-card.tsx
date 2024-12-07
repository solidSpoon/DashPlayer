import useSWR from 'swr';
import { cn } from '@/fronted/lib/utils';
import React from 'react';
import { SWR_KEY, swrApiMutate, swrMutate } from '@/fronted/lib/swr-util';
import { Film, ListVideo, Trash2 } from 'lucide-react';
import { Button } from '@/fronted/components/ui/button';
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

const api = window.electron;

const ProjectListCard = ({ video, onSelected }: {
    video: WatchHistoryVO,
    className?: string
    onSelected: () => void;
}) => {
    const { data: url } = useSWR([SWR_KEY.SPLIT_VIDEO_THUMBNAIL, video.basePath, video.fileName, video.current_position] ,
        async ([_key, path, file, time]) => {
            return await api.call('split-video/thumbnail', { filePath: PathUtil.join(path, file), time });
        }
    );
    console.log('video', video);
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
                    className={cn('')}
                    onClick={onSelected}
                >
                    <div className={cn('relative w-full rounded-lg overflow-hidden border-none')}>
                        {url ? <img
                            src={UrlUtil.file(url)}
                            style={{
                                aspectRatio: '16/9'
                            }}
                            className={cn('w-full object-cover', (hover || contextMenu) && 'filter brightness-75')}
                            alt={video.fileName}
                        /> : <div
                            style={{
                                aspectRatio: '16/9'
                            }}
                            className={'w-full bg-gray-500 flex items-center justify-center'}>
                            <Film className={'w-8 h-8'} />
                        </div>}
                        <div
                            className={cn('absolute bottom-2 right-2 text-white bg-black bg-opacity-80 rounded-md p-1 py-0.5 text-xs flex')}>
                            {!video.isFolder ? TimeUtil.secondToTimeStrCompact(video?.duration) : <>
                                <ListVideo className={'w-4 h-4'} /></>}
                        </div>
                        <Progress
                            className={cn('absolute bottom-0 left-0 w-full rounded-none h-1 bg-gray-500')}
                            value={Math.floor((video?.current_position || 0) / (video?.duration || 1) * 100)}
                        />


                        {hover && (
                            <Button
                                className={'absolute top-2 right-2 w-6 h-6 bg-background'}
                                size={'icon'}
                                variant={'ghost'}
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    console.log('swrdelete', video.id);
                                    await api.call('watch-history/group-delete', video.id);
                                    await swrApiMutate('watch-history/list');
                                }}
                            >
                                <Trash2
                                    className={'w-3 h-3'}
                                />
                            </Button>
                        )}
                    </div>

                    <div
                        className={cn('w-full line-clamp-2 break-words', (hover || contextMenu) && 'underline')}
                    >{video.fileName}</div>
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

export default ProjectListCard;
