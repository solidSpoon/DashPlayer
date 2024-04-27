import React, {} from 'react';
import {useNavigate} from 'react-router-dom';
import {strBlank} from '@/common/utils/Util';
import {cn} from "@/fronted/lib/utils";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/fronted/components/ui/card';
import FileSelector from '@/fronted/components/fileBowser/FileSelector';
import {WatchProject, WatchProjectType} from '@/backend/db/tables/watchProjects';
import useFile from '@/fronted/hooks/useFile';
import ProjectListComp from '@/fronted/components/fileBowser/project-list-comp';
import FolderSelector from '@/fronted/components/fileBowser/FolderSelecter';
import {Button} from '@/fronted/components/ui/button';
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/fronted/components/ui/tooltip";
import {FileAudio2, FileVideo2, Folder, X} from "lucide-react";
import Style from "@/fronted/styles/style";
import MediaUtil from "@/common/utils/MediaUtil";
import useSWR from "swr";
import {SWR_KEY, swrMutate} from "@/fronted/lib/swr-util";
import {WatchProjectVideo} from "@/backend/db/tables/watchProjectVideos";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger
} from "@/fronted/components/ui/context-menu";

const api = window.electron;

const ProjItem = ({hc, p, routerPid}: {
    p: WatchProject;
    hc: () => void;
    routerPid: number;
}) => {
    const navigate = useNavigate();
    const {data: v} = useSWR(['watch-project/video/detail/by-pid', p.id], ([key, projId]) => api.call('watch-project/video/detail/by-pid', projId));
    const [contextMenu, setContextMenu] = React.useState(false);
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <ContextMenu
                        onOpenChange={(open) => {
                            setContextMenu(open);
                        }}
                    >
                        <ContextMenuTrigger>
                            <div
                                className={cn(
                                    'w-full flex-shrink-0 flex justify-start items-center hover:bg-black/5 dark:hover:bg-white/5 rounded-lg gap-3 px-3 lg:px-6 py-2 group/item',
                                    routerPid === p.id ? 'bg-primary hover:bg-primary/90 dark:hover:bg-primary/90 text-primary-foreground' : '',
                                    contextMenu && routerPid !== p.id && 'bg-black/5 dark:bg-white/5'
                                )}
                                onClick={async () => {
                                    hc();
                                    if (p.project_type === WatchProjectType.FILE) {
                                        if (v?.id) {
                                            navigate(`/player/${v.id}`);
                                        }
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
                                    <div className='truncate w-0 flex-1'>{p.project_name}</div>
                                    <Button size={'icon'} variant={'ghost'}
                                            className={'w-6 h-6'}
                                            disabled={routerPid === p.id}
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                await api.call('watch-project/delete', p.id);
                                                await swrMutate(SWR_KEY.WATCH_PROJECT_LIST)
                                            }}
                                    >
                                        <X className={'w-4 h-4 scale-0 group-hover/item:scale-100'}/>
                                    </Button>
                                </>
                            </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                            <ContextMenuItem
                                onClick={async () => {
                                    await api.call('system/open-folder', p.project_path);
                                }}
                            >Show In Explorer</ContextMenuItem>
                            <ContextMenuItem
                                disabled={routerPid === p.id}
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
                    {p.project_name}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );

}

const VideoItem = ({pv, routerVid}: {
    pv: WatchProjectVideo,
    routerVid: number
}) => {
    const navigate = useNavigate();
    const [contextMenu, setContextMenu] = React.useState(false);
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <ContextMenu
                        onOpenChange={(open) => {
                            setContextMenu(open);
                        }}
                    >
                        <ContextMenuTrigger>
                            <div
                                className={cn(
                                    'w-full flex-shrink-0 flex justify-start items-center hover:bg-black/5 rounded-lg gap-3 px-3 lg:px-6 py-2',
                                    routerVid === pv.id ? 'bg-primary hover:bg-primary/90 text-primary-foreground' : '',
                                    contextMenu && 'bg-black/5 dark:bg-white/5'
                                )}
                                onClick={() => {
                                    navigate(`/player/${pv.id}`);
                                }}
                            >
                                <>
                                    {MediaUtil.isAudio(pv.video_path) &&
                                        <FileAudio2 className={cn(Style.file_browser_icon)}/>}
                                    {MediaUtil.isVideo(pv.video_path) &&
                                        <FileVideo2 className={cn(Style.file_browser_icon)}/>}
                                    <div className='truncate w-0 flex-1'>{pv.video_name}</div>
                                </>
                            </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
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
);
}

const FileBrowser = () => {
    const navigate = useNavigate();
    const pId = useFile(state => state.projectId);
    const vId = useFile(state => state.videoId);
    return (
        <Card
            onClick={(e) => {
                e.stopPropagation();
            }}
            className={cn('h-full w-full flex flex-col')}
        >
            <CardHeader>
                <CardTitle>Video Explorer</CardTitle>
                <CardDescription>Browse and play your favorite videos</CardDescription>
            </CardHeader>
            <CardContent className={cn('h-0 flex-1 w-full flex flex-col gap-2')}>
                <div
                    className={cn('justify-self-end flex mb-10 flex-wrap w-full justify-center items-center gap-2 min-h-20 rounded border border-dashed p-2')}
                >
                    <FileSelector
                        onSelected={(vid) => {
                            navigate(`/player/${vid}`);
                        }}
                        child={(hc) => (
                            <Button
                                onClick={() => hc()}
                                variant={'outline'}
                                className={cn('w-28')}
                            >Open File</Button>
                        )}
                    />
                    <FolderSelector
                        onSelected={(vid) => {
                            navigate(`/player/${vid}`);
                        }}
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
                        <VideoItem
                            key={pv.id}
                            pv={pv} routerVid={vId}/>
                    }
                    projEle={(p, hc) =>
                        <ProjItem
                            key={p.id}
                            p={p} hc={hc} routerPid={pId}/>}
                    className={cn('w-full h-0 flex-1 scrollbar-none')}
                />
            </CardContent>
        </Card>
    );
};

export default FileBrowser;
