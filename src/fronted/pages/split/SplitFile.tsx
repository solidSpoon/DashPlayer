import React, {} from 'react';
import {cn, strBlank} from '@/common/utils/Util';
import FileSelector from '@/fronted/components/fileBowser/FileSelector';
import {WatchProject, WatchProjectType} from '@/backend/db/tables/watchProjects';
import ProjectListComp from '@/fronted/components/fileBowser/project-list-comp';
import FolderSelector from '@/fronted/components/fileBowser/FolderSelecter';
import {Button} from '@/fronted/components/ui/button';
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/fronted/components/ui/tooltip';
import useSplit from "@/fronted/hooks/useSplit";
import {useShallow} from "zustand/react/shallow";
import {WatchProjectVideo} from "@/backend/db/tables/watchProjectVideos";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger
} from "@/fronted/components/ui/context-menu";
import MediaTypeUtil from "@/common/utils/MediaTypeUtil";
import {FileAudio2, FileVideo2, Folder, X} from "lucide-react";
import Style from "@/fronted/styles/style";
import {SWR_KEY, swrMutate} from "@/fronted/lib/swr-util";
import useSWR from "swr";

const api = window.electron;


const VideoEle = ({pv, updateFile}: {
    pv: WatchProjectVideo,
    updateFile: (path: string) => void;
}) => {
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
                                    contextMenu && 'bg-black/5 dark:bg-white/5'
                                )}
                                onClick={() => {
                                    updateFile(pv.video_path);
                                    updateFile(pv.subtitle_path);
                                }}
                            >
                                <>
                                    {MediaTypeUtil.isAudio(pv.video_path) &&
                                        <FileAudio2 className={cn(Style.file_browser_icon)}/>}
                                    {MediaTypeUtil.isVideo(pv.video_path) &&
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
const ProjEle = ({p, hc, updateFile}: { p: WatchProject, hc: () => void, updateFile: (path: string) => void }) => {

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
                                    contextMenu && 'bg-black/5 dark:bg-white/5'
                                )}
                                onClick={async () => {
                                    hc();
                                    if (p.project_type === WatchProjectType.FILE) {
                                        const pVideo = await api.call('watch-project/video/detail/by-pid', p.id);
                                        updateFile(pVideo.video_path);
                                        updateFile(pVideo.subtitle_path);
                                    }

                                }}
                            >
                                <>
                                    {(strBlank(v?.video_path) || p.project_type === WatchProjectType.DIRECTORY) &&
                                        <Folder className={cn(Style.file_browser_icon)}/>}
                                    {p.project_type === WatchProjectType.FILE && MediaTypeUtil.isAudio(v?.video_path) &&
                                        <FileAudio2 className={cn(Style.file_browser_icon)}/>}
                                    {p.project_type === WatchProjectType.FILE && MediaTypeUtil.isVideo(v?.video_path) &&
                                        <FileVideo2 className={cn(Style.file_browser_icon)}/>}
                                    <div className='truncate w-0 flex-1'>{p.project_name}</div>
                                    <Button size={'icon'} variant={'ghost'}
                                            className={'w-6 h-6'}
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


const SplitFile = () => {

    const {updateFile, videoPath} = useSplit(useShallow(s => ({
        updateFile: s.updateFile,
        videoPath: s.videoPath
    })));

    return (
        <div className={cn('w-full h-full flex flex-col rounded p-4')}>
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
                videoEle={(pv) => <VideoEle pv={pv} updateFile={updateFile}/>}
                projEle={(p, hc) => <ProjEle p={p} hc={hc} updateFile={updateFile}/>}
                className={cn('w-full h-0 flex-1 scrollbar-none')}
            />
        </div>
    );
};

export default SplitFile;
