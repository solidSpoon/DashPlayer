import React from 'react';
import { cn } from '@/fronted/lib/utils';
import ProjectListComp from '@/fronted/features/file-browser/components/project-list-comp';
import { Folder } from 'lucide-react';
import { SWR_KEY, swrApiMutate, swrMutate } from '@/fronted/lib/swr-util';
import MediaUtil from '@/common/utils/MediaUtil';
import FolderSelector, { FolderSelectAction } from '@/fronted/features/file-browser/components/FolderSelector';
import FileSelector from '@/fronted/features/file-browser/components/FileSelector';
import ProjItem2 from '@/fronted/features/file-browser/components/ProjItem2';
import VideoItem2 from '@/fronted/features/file-browser/components/VideoItem2';
import StrUtil from '@/common/utils/str-util';
import PathUtil from '@/common/utils/PathUtil';
import BackNavItem from '@/fronted/features/file-browser/components/BackNavItem';
import { transcriptApi } from '../transcriptApi';
import { TranscriptTask } from '@/common/contracts/transcript/transcript-task';

/** 转录文件浏览区属性。 */
export interface TranscriptFileProps {
    /** 后端返回的全部转录任务。 */
    tasks: TranscriptTask[];
    /** 将视频加入后端任务表。 */
    onEnqueue: (filePath: string) => Promise<void>;
}

/** 浏览媒体文件，并将选中的视频加入后端转录列表。 */
const TranscriptFile = ({ tasks, onEnqueue }: TranscriptFileProps) => {
    const queue = new Set(tasks.map((task) => task.file));
    return (
        <div className={cn('flex-1 flex flex-col rounded-lg border bg-muted/20 p-4 min-h-0')}>
            <div
                className={cn('flex flex-wrap w-full justify-center items-center gap-2 min-h-14 rounded-lg border border-dashed p-2 mb-3')}
            >
                <FileSelector onSelected={async (ps) => {
                    const vp = ps.find(MediaUtil.isMedia);
                    const sp = ps.find(MediaUtil.isSrt);
                    if (vp) {
                        await transcriptApi.createWatchHistory(ps);
                    }
                    if (sp) {
                        if (StrUtil.isNotBlank(vp)) {
                            await transcriptApi.attachSubtitle(vp, sp);
                        }
                    }
                    await swrApiMutate('watch-history/list');
                    await swrMutate(SWR_KEY.WATCH_PROJECT_DETAIL);
                }} />
                <FolderSelector onSelected={FolderSelectAction.defaultAction()} />
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
                    const ctxMenus = [
                        {
                            icon: <Folder />,
                            text: 'Show In Explorer',
                            onClick: async () => {
                                await transcriptApi.openFolder(pv.basePath);
                            }
                        }
                    ];
                    return <VideoItem2 pv={pv}
                                       ctxMenus={ctxMenus}
                                       onClick={() => {
                                           void onEnqueue(PathUtil.join(pv.basePath, pv.fileName));
                                       }}
                                       variant={queue.has(PathUtil.join(pv.basePath, pv.fileName)) ? 'lowlight' : 'normal'} />;
                }}
                projEle={(p, hc) => {
                    const ctxMenus = [
                        {
                            icon: <Folder />,
                            text: 'Show In Explorer',
                            onClick: async () => {
                                await transcriptApi.openFolder(p.basePath);
                            }
                        }
                    ];
                    return <ProjItem2 v={p}
                                      ctxMenus={ctxMenus}
                                      variant={queue.has(PathUtil.join(p.basePath, p.fileName)) ? 'lowlight' : 'normal'}
                                      onClick={() => {
                                          hc();
                                          if (!p.isFolder) {
                                              void onEnqueue(PathUtil.join(p.basePath, p.fileName));
                                          }
                                      }} />;
                }}

                className={cn('w-full h-0 flex-1 scrollbar-none')}
            />
        </div>
    );
};

export default TranscriptFile;
