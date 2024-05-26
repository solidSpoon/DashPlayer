import React from 'react';
import Util from '@/common/utils/Util';
import {cn} from '@/fronted/lib/utils';
import {WatchProject, WatchProjectType} from '@/backend/db/tables/watchProjects';
import ProjectListComp from '@/fronted/components/fileBowser/project-list-comp';
import {Button} from '@/fronted/components/ui/button';
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/fronted/components/ui/tooltip';
import FileBrowserIcon from '@/fronted/components/fileBowser/FileBrowserIcon';
import {ArrowRight, FileAudio2, FileVideo2, Folder} from 'lucide-react';
import {WatchProjectVideo} from '@/backend/db/tables/watchProjectVideos';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger
} from '@/fronted/components/ui/context-menu';
import {SWR_KEY, swrMutate} from '@/fronted/lib/swr-util';
import Style from '@/fronted/styles/style';
import MediaUtil from '@/common/utils/MediaUtil';
import useTranscript from '@/fronted/hooks/useTranscript';
import {useShallow} from 'zustand/react/shallow';
import FolderSelector, { FolderSelectAction } from '@/fronted/components/fileBowser/FolderSelector';
import FileSelector from "@/fronted/components/fileBowser/FileSelector";
import ProjItem2 from "@/fronted/components/fileBowser/ProjItem2";
import VideoItem2 from "@/fronted/components/fileBowser/VideoItem2";

const api = window.electron;
const TranscriptFile = () => {
    const {files, onAddToQueue} = useTranscript(useShallow(s => ({
        files: s.files,
        onAddToQueue: s.onAddToQueue
    })));
    const queue = files.map(f => f.file);
    return (
        <div className={cn('w-full h-full flex flex-col border rounded p-4')}>
            <div
                className={cn('justify-self-end flex mb-10 flex-wrap w-full justify-center items-center gap-2 min-h-20 rounded border border-dashed p-2')}
            >
                <FileSelector onSelected={async (ps) => {
                    const vp = ps.find(MediaUtil.isMedia);
                    const sp = ps.find(MediaUtil.isSrt);
                    if (vp) {
                        await api.call('watch-project/create/from-files', ps);
                    }
                    if (sp) {
                        if (Util.strNotBlank(vp)) {
                            await api.call('watch-project/attach-srt', {videoPath: vp, srtPath: sp});
                        }
                    }
                    await swrMutate(SWR_KEY.WATCH_PROJECT_LIST);
                    await swrMutate(SWR_KEY.WATCH_PROJECT_DETAIL);
                }}/>
                <FolderSelector onSelected={FolderSelectAction.defaultAction()}/>
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
                                            'w-full flex-shrink-0 flex justify-start items-center hover:bg-black/5 rounded-lg gap-3 px-3 lg:px-6 py-2'
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
                videoEle={(pv) => {
                    const ctxMenus = [
                        {
                            icon: <Folder/>,
                            text: 'Show In Explorer',
                            onClick: async () => {
                                await api.call('system/open-folder', pv.video_path);
                            }
                        }
                    ];
                    return <VideoItem2 pv={pv}
                                       ctxMenus={ctxMenus}
                                       onClick={() => {
                                           onAddToQueue(pv.video_path);
                                       }}
                                       variant={queue.includes(pv.video_path) ? 'lowlight' : 'normal'}/>
                }}
                projEle={(p, hc) => {
                    const ctxMenus = [
                        {
                            icon: <Folder/>,
                            text: 'Show In Explorer',
                            onClick: async () => {
                                await api.call('system/open-folder', p.project_path);
                            }
                        },
                    ];
                    return <ProjItem2 p={p} v={p.video}
                                      ctxMenus={ctxMenus}
                                      variant={queue.includes(p.project_path) ? 'lowlight' : 'normal'}
                                      onClick={() => {
                                          hc();
                                          if (p.project_type === WatchProjectType.FILE) {
                                              const pVideo = p.video;
                                              onAddToQueue(pVideo.video_path);
                                          }
                                      }}/>
                }}

                className={cn('w-full h-0 flex-1 scrollbar-none')}
            />
        </div>
    );
};

export default TranscriptFile;
