import React from 'react';
import {cn} from '@/fronted/lib/utils';
import ProjectListComp from '@/fronted/components/feature/file-browser/project-list-comp';
import useSplit from '../splitStore';
import {useShallow} from 'zustand/react/shallow';
import MediaUtil from '@/common/utils/MediaUtil';
import {Folder, X} from 'lucide-react';
import { SWR_KEY, swrApiMutate, swrMutate } from '@/fronted/lib/swr-util';
import FileSelector from '@/fronted/components/feature/file-browser/FileSelector';
import FolderSelector, { FolderSelectAction } from '@/fronted/components/feature/file-browser/FolderSelector';
import ProjItem2 from '@/fronted/components/feature/file-browser/ProjItem2';
import VideoItem2 from '@/fronted/components/feature/file-browser/VideoItem2';
import StrUtil from '@/common/utils/str-util';
import PathUtil from '@/common/utils/PathUtil';
import BackNavItem from '@/fronted/components/feature/file-browser/BackNavItem';
import { splitApi } from '../splitApi';
const SplitFile = () => {

    const {updateFile, videoPath} = useSplit(useShallow(s => ({
        updateFile: s.updateFile,
        videoPath: s.videoPath
    })));

    return (
        <div className={cn('w-full h-full flex flex-col rounded p-4')}>
            <div
                className={cn('flex flex-wrap w-full justify-center items-center gap-2 min-h-14 rounded-lg border border-dashed p-2 mb-3')}
            >
                <FileSelector onSelected={async (ps) => {
                    const vp = ps.find(MediaUtil.isMedia);
                    const sp = ps.find(MediaUtil.isSrt);
                    if (vp) {
                        updateFile(vp);
                        await splitApi.createWatchHistory(ps);
                    }
                    if (sp) {
                        updateFile(sp);
                        if (StrUtil.isNotBlank(videoPath)) {
                            await splitApi.attachSubtitle(videoPath, sp);
                        }
                    }
                    await swrApiMutate('watch-history/list');
                    await swrMutate(SWR_KEY.WATCH_PROJECT_DETAIL);
                }}/>
                <FolderSelector onSelected={FolderSelectAction.defaultAction()}/>
            </div>

            <ProjectListComp
                backEle={(root, currentPath, hc) => (
                    <BackNavItem
                        root={root}
                        currentPath={currentPath}
                        onClick={hc}
                    />
                )}
                videoEle={(pv) => {
                    return <VideoItem2 pv={pv}
                                       variant={PathUtil.join(pv.basePath,pv.fileName) === videoPath ? 'highlight' : 'normal'}
                                       ctxMenus={[
                                           {
                                               icon: <Folder/>,
                                               text: 'Show In Explorer',
                                               onClick: async () => {
                                                   await splitApi.openFolder(pv.basePath);
                                               }
                                           }
                                       ]}
                                       onClick={() => {
                                           updateFile(PathUtil.join(pv.basePath,pv.fileName));
                                           updateFile(pv.srtFile);
                                       }}
                    />
                }}
                projEle={(p, hc) => {
                    const ctxMenus = [
                        {
                            icon: <Folder/>,
                            text: 'Show In Explorer',
                            onClick: async () => {
                                await splitApi.openFolder(p.basePath);
                            }
                        },
                        {
                            icon: <X/>,
                            text: 'Delete',
                            disabled: false,
                            onClick: async () => {
                                await splitApi.deleteWatchHistoryGroup(p.id);
                                await swrApiMutate('watch-history/list');
                            }
                        }
                    ];
                    return <ProjItem2  v={p}
                                      variant={PathUtil.join(p?.basePath, p?.fileName) === videoPath ? 'highlight' : 'normal'}
                                      ctxMenus={ctxMenus}
                                      onClick={() => {
                                          hc();
                                          if (!p.isFolder) {
                                              updateFile(PathUtil.join(p.basePath, p.fileName));
                                              updateFile(p.srtFile);
                                          }
                                      }}/>
                }}
                className={cn('w-full h-0 flex-1 scrollbar-none')}
            />
        </div>
    );
};

export default SplitFile;
