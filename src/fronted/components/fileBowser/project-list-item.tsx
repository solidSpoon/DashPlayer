import useSWR from 'swr';
import {cn} from "@/fronted/lib/utils";
import React from 'react';
import {WatchProject, WatchProjectType} from '@/backend/db/tables/watchProjects';
import {SWR_KEY, swrMutate} from '@/fronted/lib/swr-util';
import {Button} from '@/fronted/components/ui/button';
import {Film, ListVideo, Trash2} from 'lucide-react';
import CollUtil from "@/common/utils/CollUtil";
import TimeUtil from "@/common/utils/TimeUtil";
import {Progress} from "@/fronted/components/ui/progress";
import {ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger} from "@/fronted/components/ui/context-menu";

const api = window.electron;

const ProjectListItem = ({proj, onSelected}: {
    proj: WatchProject,
    className?: string,
    onSelected: () => void;
}) => {
    const {data: projDetail} = useSWR(['watch-project/detail', proj.id], ([key, projId]) => api.call('watch-project/detail', projId));
    const video = projDetail?.videos?.find((v) => v.current_playing) || CollUtil.safeGet(projDetail?.videos, 0);

    const {data: url} = useSWR(video?.video_path ?
            [SWR_KEY.SPLIT_VIDEO_THUMBNAIL, video.video_path, video.current_time] : null,
        async ([key, path, time]) => {
            return await api.call('split-video/thumbnail', {filePath: path, time});
        }
    );
    console.log('updtime', video?.updated_at);
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
                        {url ? <img
                            src={url}
                            style={{
                                aspectRatio: '16/9'
                            }}
                            className="w-full object-cover"
                            alt={proj.project_name}
                        /> : <div
                            style={{
                                aspectRatio: '16/9'
                            }}
                            className={'w-full bg-gray-500 flex items-center justify-center'}>
                            <Film/>
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
                    </div>

                    <div className={'flex-1 w-0'}>
                        <div
                            className={' w-full line-clamp-2 break-words h-fit'}
                        >{proj.project_name}</div>
                        <div className={'text-sm text-muted-foreground mt-2'}>
                            {TimeUtil.dateToRelativeTime(TimeUtil.isoToDate(video?.updated_at))}
                        </div>
                    </div>

                    <Button
                        className={cn('w-6 h-6 bg-background self-center', !hover && 'scale-0')}
                        size={'icon'}
                        variant={'outline'}
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

export default ProjectListItem;
