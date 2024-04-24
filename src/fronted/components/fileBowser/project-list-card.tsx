import useSWR from 'swr';
import {cn} from '@/common/utils/Util';
import React from 'react';
import {WatchProject, WatchProjectType} from '@/backend/db/tables/watchProjects';
import {SWR_KEY, swrMutate} from '@/fronted/lib/swr-util';
import {Film, ListVideo, Trash2} from 'lucide-react';
import {Button} from '@/fronted/components/ui/button';
import TimeUtil from "@/common/utils/TimeUtil";
import CollUtils from "@/common/utils/CollUtils";
import {Progress} from "@/fronted/components/ui/progress";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger
} from "@/fronted/components/ui/context-menu";

const api = window.electron;

const ProjectListCard = ({proj, onSelected}: {
    proj: WatchProject,
    className?: string
    onSelected: () => void;
}) => {
    // const { data: video } = useSWR(['watch-project/video/detail/by-pid', proj.id], ([key, projId]) => api.call('watch-project/video/detail/by-pid', projId));
    const {data: projDetail} = useSWR(['watch-project/detail', proj.id], ([key, projId]) => api.call('watch-project/detail', projId));
    const video = projDetail?.videos?.find((v) => v.current_playing) || CollUtils.safeGet(projDetail?.videos, 0);
    console.log('tttttttt', video);
    const {data: url} = useSWR(video?.video_path ?
            [SWR_KEY.SPLIT_VIDEO_THUMBNAIL, video.video_path, video.current_time] : null,
        async ([_key, path, time]) => {
            return await api.call('split-video/thumbnail', {filePath: path, time});
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
                    className={cn('')}
                    onClick={onSelected}
                >
                    <div className={cn('relative w-full rounded-lg overflow-hidden border-none')}>
                        {url ? <img
                            src={url}
                            style={{
                                aspectRatio: '16/9'
                            }}
                            className={cn("w-full object-cover", (hover || contextMenu) && 'filter brightness-75')}
                            alt={proj.project_name}
                        /> : <div
                            style={{
                                aspectRatio: '16/9'
                            }}
                            className={'w-full bg-gray-500 flex items-center justify-center'}>
                            <Film className={'w-8 h-8'}/>
                        </div>}
                        <div
                            className={cn('absolute bottom-2 right-2 text-white bg-black bg-opacity-80 rounded-md p-1 py-0.5 text-xs flex')}>
                            {proj.project_type === WatchProjectType.FILE ? TimeUtil.secondToTimeStrCompact(video?.duration) : <>
                                <ListVideo className={'w-4 h-4 mr-1'}/>{`${projDetail?.videos?.length} videos`}</>}
                        </div>
                        <Progress
                            className={cn('absolute bottom-0 left-0 w-full rounded-none h-1 bg-gray-500')}
                            value={Math.floor((video?.current_time || 0) / (video?.duration || 1) * 100)}
                        />


                        {hover && (
                            <Button
                                className={'absolute top-2 right-2 w-6 h-6 bg-background'}
                                size={'icon'}
                                variant={'ghost'}
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    console.log('swrdelete', proj.id);
                                    await api.call('watch-project/delete', proj.id);
                                    await swrMutate(SWR_KEY.WATCH_PROJECT_LIST);
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
                    >{proj.project_name}</div>
                </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
                <ContextMenuItem
                    onClick={async () => {
                        await api.call('system/open-folder', proj.project_path);
                    }}
                >Show In Explorer</ContextMenuItem>
                <ContextMenuItem
                    onClick={async () => {
                        await api.call('watch-project/delete', proj.id);
                        await swrMutate(SWR_KEY.WATCH_PROJECT_LIST);
                    }}
                >Delete</ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>

    );
};

export default ProjectListCard;
