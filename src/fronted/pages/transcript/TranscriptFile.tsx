import React, {} from 'react';
import { cn } from '@/common/utils/Util';
import FileSelector from '@/fronted/components/fileBowser/FileSelector';
import { WatchProjectType } from '@/backend/db/tables/watchProjects';
import ProjectListComp from '@/fronted/components/fileBowser/project-list-comp';
import FolderSelector from '@/fronted/components/fileBowser/FolderSelecter';
import { Button } from '@/fronted/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import FileBrowserIcon from '@/fronted/components/fileBowser/FileBrowserIcon';
import { ArrowRight } from 'lucide-react';

const TranscriptFile = ({onAddToQueue, queue}:{
    onAddToQueue:(p:string)=>void,
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
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <Button
                                            disabled={queue.includes(pv.video_path)}
                                            onClick={() => {
                                                onAddToQueue(pv.video_path);
                                            }}
                                            variant={'ghost'} size={'icon'} className={cn('flex-shrink-0')}>
                                            <ArrowRight className={'w-4 h-4'} />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {queue.includes(pv.video_path) ? '已在转录队列中' : '添加到转录队列'}
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
                                                <ArrowRight  className={'w-4 h-4'} />
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
                }}
                className={cn('w-full h-0 flex-1 scrollbar-none')}
            />
        </div>
    );
};

export default TranscriptFile;
