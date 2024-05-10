import React, {} from 'react';
import Util from '@/common/utils/Util';
import {cn} from '@/fronted/lib/utils';
import {WatchProjectType} from '@/backend/db/tables/watchProjects';
import ProjectListComp from '@/fronted/components/fileBowser/project-list-comp';
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/fronted/components/ui/tooltip';
import useSplit from '@/fronted/hooks/useSplit';
import {useShallow} from 'zustand/react/shallow';
import MediaUtil from '@/common/utils/MediaUtil';
import {Folder, X} from 'lucide-react';
import {SWR_KEY, swrMutate} from '@/fronted/lib/swr-util';
import FileSelector from "@/fronted/components/fileBowser/FileSelector";
import FolderSelector from "@/fronted/components/fileBowser/FolderSelector";
import ProjItem2 from "@/fronted/components/fileBowser/ProjItem2";
import VideoItem2 from "@/fronted/components/fileBowser/VideoItem2";

const api = window.electron;
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
                <FileSelector onSelected={async (ps) => {
                    const vp = ps.find(MediaUtil.isMedia);
                    const sp = ps.find(MediaUtil.isSrt);
                    if (vp) {
                        updateFile(vp);
                        await api.call('watch-project/create/from-files', ps);
                    }
                    if (sp) {
                        updateFile(sp);
                        if (Util.strNotBlank(videoPath)) {
                            await api.call('watch-project/attach-srt', {videoPath, srtPath: sp});
                        }
                    }
                    await swrMutate(SWR_KEY.WATCH_PROJECT_LIST);
                    await swrMutate(SWR_KEY.WATCH_PROJECT_DETAIL);
                }}/>
                <FolderSelector/>
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
                    return <VideoItem2 pv={pv}
                                       variant={pv.video_path === videoPath ? 'highlight' : 'normal'}
                                       ctxMenus={[
                                           {
                                               icon: <Folder/>,
                                               text: 'Show In Explorer',
                                               onClick: async () => {
                                                   await api.call('system/open-folder', pv.video_path);
                                               }
                                           }
                                       ]}
                                       onClick={() => {
                                           updateFile(pv.video_path);
                                           updateFile(pv.subtitle_path);
                                       }}
                    />
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
                        {
                            icon: <X/>,
                            text: 'Delete',
                            disabled: false,
                            onClick: async () => {
                                await api.call('watch-project/delete', p.id);
                                await swrMutate(SWR_KEY.WATCH_PROJECT_LIST);
                            }
                        }
                    ];
                    return <ProjItem2 p={p} v={p.video}
                                      variant={p.video?.video_path === videoPath ? 'highlight' : 'normal'}
                                      ctxMenus={ctxMenus}
                                      onClick={() => {
                                          hc();
                                          if (p.project_type === WatchProjectType.FILE) {
                                              const pVideo = p.video;
                                              updateFile(pVideo.video_path);
                                              updateFile(pVideo.subtitle_path);
                                          }
                                      }}/>
                }}
                className={cn('w-full h-0 flex-1 scrollbar-none')}
            />
        </div>
    );
};

export default SplitFile;
