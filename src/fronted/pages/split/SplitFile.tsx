import React, {} from 'react';
import {cn} from '@/common/utils/Util';
import FileSelector from '@/fronted/components/fileBowser/FileSelector';
import {WatchProjectType} from '@/backend/db/tables/watchProjects';
import ProjectListComp from '@/fronted/components/fileBowser/project-list-comp';
import FolderSelector from '@/fronted/components/fileBowser/FolderSelecter';
import {Button} from '@/fronted/components/ui/button';
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/fronted/components/ui/tooltip';
import FileBrowserIcon from '@/fronted/components/fileBowser/FileBrowserIcon';
import useSplit from "@/fronted/hooks/useSplit";
import {useShallow} from "zustand/react/shallow";

const api = window.electron;

const SplitFile = () => {

    const {updateFile,videoPath} = useSplit(useShallow(s => ({
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
                                    {root ? '.': '返回上一级'}
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    );
                }}
                videoEle={(pv) => {
                    return (
                        <div className={cn('flex')}>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div
                                            className={cn(
                                                'w-0 flex-1 flex-shrink-0 flex justify-start items-center  rounded-lg gap-3 px-3 lg:px-6 py-2',
                                                'hover:bg-secondary',
                                            )}
                                            onClick={() => {
                                                updateFile(pv.video_path);
                                                updateFile(pv.subtitle_path);
                                            }}
                                        >
                                            <>
                                                {FileBrowserIcon['video'] ?? <></>}
                                                <div className="truncate text-base">{pv.video_name}</div>
                                            </>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent
                                        side={'bottom'}
                                        align={'start'}
                                    >
                                        {pv.video_path}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    );
                }}
                projEle={(p, hc) => {
                    return (
                        <div className={cn('flex')}>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div
                                            className={cn(
                                                'w-0 flex-1 flex-shrink-0 flex justify-start items-center  rounded-lg gap-3 px-3 lg:px-6 py-2',
                                                'hover:bg-secondary',
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
                                                {FileBrowserIcon[p.project_type === WatchProjectType.FILE ? 'video' : 'folder'] ?? <></>}
                                                <div className="truncate text-base">{p.project_name}</div>
                                            </>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent
                                        side={'bottom'}
                                        align={'start'}
                                    >
                                        {p.project_path}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    );
                }}
                className={cn('w-full h-0 flex-1 scrollbar-none')}
            />
        </div>
    );
};

export default SplitFile;
