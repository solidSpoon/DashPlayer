import React, {} from 'react';
import { cn } from '@/common/utils/Util';
import FileSelector from '@/fronted/components/fileBowser/FileSelector';
import FileItem from '@/fronted/components/fileBowser/FileItem';
import { WatchProjectType } from '@/backend/db/tables/watchProjects';
import ProjectListComp from '@/fronted/components/fileBowser/project-list-comp';
import FolderSelector from '@/fronted/components/fileBowser/FolderSelecter';
import { Button } from '@/fronted/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import FileBrowserIcon from '@/fronted/components/fileBowser/FileBrowserIcon';

const SplitFile = ({onAddToQueue, queue}:{
    onAddToQueue:(p:string)=>void,
    queue: string[]
}) => {
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
                        <FileItem
                            icon={'none'}
                            onClick={hc}
                            content={root ? '.' : '..'}
                        />
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
                                                'w-0 flex-1 flex-shrink-0 flex justify-start items-center  rounded-lg gap-3 px-3 lg:px-6 py-2'
                                            )}
                                            onClick={() => {
                                                onAddToQueue(pv.video_path);
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
                                                'w-0 flex-1 flex-shrink-0 flex justify-start items-center  rounded-lg gap-3 px-3 lg:px-6 py-2'
                                            )}
                                            onClick={() => {
                                                hc();
                                                if (p.project_type === WatchProjectType.FILE) {
                                                    onAddToQueue(p.project_path);
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
