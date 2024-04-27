import React, {} from 'react';
import {strBlank} from '@/common/utils/Util';
import {cn} from "@/fronted/lib/utils";
import FileSelector from '@/fronted/components/fileBowser/FileSelector';
import {WatchProject, WatchProjectType} from '@/backend/db/tables/watchProjects';
import ProjectListComp from '@/fronted/components/fileBowser/project-list-comp';
import FolderSelector from '@/fronted/components/fileBowser/FolderSelecter';
import {Button} from '@/fronted/components/ui/button';
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/fronted/components/ui/tooltip';
import FileBrowserIcon from '@/fronted/components/fileBowser/FileBrowserIcon';
import {ArrowRight, FileAudio2, FileVideo2, Folder} from 'lucide-react';
import {WatchProjectVideo} from "@/backend/db/tables/watchProjectVideos";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger
} from "@/fronted/components/ui/context-menu";
import {SWR_KEY, swrMutate} from "@/fronted/lib/swr-util";
import Style from "@/fronted/styles/style";
import MediaUtil from "@/common/utils/MediaUtil";
import useSWR from "swr";

const api = window.electron;
const ProjEle = ({p, hc, onAddToQueue, queue}: {
    p: WatchProject,
    hc: () => void,
    onAddToQueue: (p: string) => void,
    queue: string[]
}) => {
    const {data: v} = useSWR(['watch-project/video/detail/by-pid', p.id], ([key, projId]) => api.call('watch-project/video/detail/by-pid', projId));
    const [contextMenu, setContextMenu] = React.useState(false);

    return (
        <div className={cn('flex')}>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <ContextMenu
                            onOpenChange={(open) => {
                                setContextMenu(open);
                            }}
                        >
                            <ContextMenuTrigger
                                className={cn('w-0 flex-1 flex-shrink-0')}
                            >
                                <div
                                    className={cn(
                                        'w-full flex justify-start items-center  rounded-lg gap-3 px-3 lg:px-6 py-2',
                                        contextMenu && 'bg-black/5 dark:bg-white/5'
                                    )}
                                    onClick={() => {
                                        hc();
                                        if (p.project_type === WatchProjectType.FILE) {
                                            onAddToQueue(p.project_path);
                                        }
                                    }}
                                >
                                    <>
                                        {(strBlank(v?.video_path) || p.project_type === WatchProjectType.DIRECTORY) &&
                                            <Folder className={cn(Style.file_browser_icon)}/>}
                                        {p.project_type === WatchProjectType.FILE && MediaUtil.isAudio(v?.video_path) &&
                                            <FileAudio2 className={cn(Style.file_browser_icon)}/>}
                                        {p.project_type === WatchProjectType.FILE && MediaUtil.isVideo(v?.video_path) &&
                                            <FileVideo2 className={cn(Style.file_browser_icon)}/>}
                                        <div className="truncate text-base">{p.project_name}</div>
                                    </>
                                </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent>
                                {p.project_type === WatchProjectType.FILE && (
                                    <ContextMenuItem
                                        disabled={queue.includes(p.project_path)}
                                        onClick={() => {
                                            onAddToQueue(p.project_path);
                                        }}
                                    >Add To Queue</ContextMenuItem>
                                )}
                                <ContextMenuItem
                                    onClick={async () => {
                                        await api.call('system/open-folder', p.project_path);
                                    }}
                                >Show In Explorer</ContextMenuItem>
                                <ContextMenuItem
                                    onClick={async () => {
                                        await api.call('watch-project/delete', p.id);
                                        await swrMutate(SWR_KEY.WATCH_PROJECT_LIST);
                                    }}
                                >Delete</ContextMenuItem>
                            </ContextMenuContent>
                        </ContextMenu>
                    </TooltipTrigger>
                    <TooltipContent
                        side={'bottom'}
                        align={'start'}
                    >
                        {p.project_path}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            {p.project_type === WatchProjectType.FILE ? (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger>
                            <Button
                                disabled={queue.includes(p.project_path)}
                                onClick={() => {
                                    onAddToQueue(p.project_path);
                                }}
                                variant={'ghost'} size={'icon'} className={cn('flex-shrink-0')}>
                                <ArrowRight className={'w-4 h-4'}/>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            {queue.includes(p.project_path) ? '已在转录队列中' : '添加到转录队列'}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            ) : <div className={'w-10 h-10'}></div>}
        </div>
    );
}

const VideoEle = ({pv, onAddToQueue, queue}: {
    pv: WatchProjectVideo,
    onAddToQueue: (p: string) => void,
    queue: string[]
}) => {
    const [contextMenu, setContextMenu] = React.useState(false);
    return (
        <div className={cn('flex group/item')}>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <ContextMenu
                            onOpenChange={(open) => {
                                setContextMenu(open);
                            }}
                        >
                            <ContextMenuTrigger
                                className={cn('w-0 flex-1 flex-shrink-0')}
                            >
                                <div
                                    className={cn(
                                        'w-full flex justify-start items-center  rounded-lg gap-3 px-3 lg:px-6 py-2',
                                        contextMenu && 'bg-black/5 dark:bg-white/5'
                                    )}
                                    onClick={() => {
                                        onAddToQueue(pv.video_path);
                                    }}
                                >
                                    <>
                                        {FileBrowserIcon['video'] ?? <></>}
                                        <div
                                            className="truncate text-base group-hover/item:underline group-hover/item:underline-offset-2">
                                            {pv.video_name}
                                        </div>
                                    </>
                                </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent>
                                <ContextMenuItem
                                    disabled={queue.includes(pv.video_path)}
                                    onClick={() => {
                                        onAddToQueue(pv.video_path);
                                    }}
                                >Add To Queue</ContextMenuItem>
                                <ContextMenuItem
                                    onClick={async () => {
                                        await api.call('system/open-folder', pv.video_path);
                                    }}
                                >Show In Explorer</ContextMenuItem>
                            </ContextMenuContent>
                        </ContextMenu>
                    </TooltipTrigger>
                    <TooltipContent
                        side={'bottom'}
                        align={'start'}
                    >
                        {pv.video_path}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger>
                        <Button
                            disabled={queue.includes(pv.video_path)}
                            onClick={() => {
                                onAddToQueue(pv.video_path);
                            }}
                            variant={'ghost'} size={'icon'} className={cn('flex-shrink-0')}>
                            <ArrowRight className={'w-4 h-4'}/>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        {queue.includes(pv.video_path) ? '已在转录队列中' : '添加到转录队列'}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

        </div>
    );
}
const TranscriptFile = ({onAddToQueue, queue}: {
    onAddToQueue: (p: string) => void,
    queue: string[]
}) => {
    return (
        <div className={cn('w-full h-full flex flex-col border rounded p-4')}>
            <div
                className={cn('justify-self-end flex mb-10 flex-wrap w-full justify-center items-center gap-2 min-h-20 rounded border border-dashed p-2')}
            >
                <FileSelector
                    child={(hc) => (
                        <Button
                            onClick={() => hc()}
                            variant={'outline'}
                            className={cn('w-28')}
                        >Open File</Button>
                    )}
                />
                <FolderSelector
                    child={(hc) => (
                        <Button
                            onClick={() => hc()}
                            variant={'outline'}
                            className={cn('w-28')}
                        >Open Folder</Button>
                    )}
                />
            </div>

            <ProjectListComp
                backEle={(root, hc) => {
                    return (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div
                                        onClick={hc}
                                        className={cn(
                                            'w-full flex-shrink-0 flex justify-start items-center hover:bg-black/5 rounded-lg gap-3 px-3 lg:px-6 py-2',
                                        )}
                                    >
                                        {root ? '.' : '..'}
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent
                                    side={'bottom'}
                                    align={'start'}
                                >
                                    {root ? '.' : '返回上一级'}
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    );
                }}
                videoEle={(pv) =>
                    <VideoEle
                        pv={pv}
                        onAddToQueue={onAddToQueue}
                        queue={queue}
                    />}
                projEle={(p, hc) =>
                    <ProjEle
                        p={p}
                        hc={hc}
                        onAddToQueue={onAddToQueue}
                        queue={queue}
                    />}
                className={cn('w-full h-0 flex-1 scrollbar-none')}
            />
        </div>
    );
};

export default TranscriptFile;
