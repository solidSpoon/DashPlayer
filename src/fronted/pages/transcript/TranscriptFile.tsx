import React from 'react';
import { cn } from '@/fronted/lib/utils';
import ProjectListComp from '@/fronted/components/fileBowser/project-list-comp';
import { Folder } from 'lucide-react';
import { SWR_KEY, swrApiMutate, swrMutate } from '@/fronted/lib/swr-util';
import MediaUtil from '@/common/utils/MediaUtil';
import useTranscript from '@/fronted/hooks/useTranscript';
import { useShallow } from 'zustand/react/shallow';
import FolderSelector, { FolderSelectAction } from '@/fronted/components/fileBowser/FolderSelector';
import FileSelector from '@/fronted/components/fileBowser/FileSelector';
import ProjItem2 from '@/fronted/components/fileBowser/ProjItem2';
import VideoItem2 from '@/fronted/components/fileBowser/VideoItem2';
import StrUtil from '@/common/utils/str-util';
import PathUtil from '@/common/utils/PathUtil';
import BackNavItem from '@/fronted/components/fileBowser/BackNavItem';

const api = window.electron;
const TranscriptFile = () => {
    const { files, onAddToQueue } = useTranscript(useShallow(s => ({
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
                        await api.call('watch-history/create', ps);
                    }
                    if (sp) {
                        if (StrUtil.isNotBlank(vp)) {
                            await api.call('watch-history/attach-srt', { videoPath: vp, srtPath: sp });
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
                                await api.call('system/open-folder', pv.basePath);
                            }
                        }
                    ];
                    return <VideoItem2 pv={pv}
                                       ctxMenus={ctxMenus}
                                       onClick={() => {
                                           onAddToQueue(PathUtil.join(pv.basePath, pv.fileName));
                                       }}
                                       variant={queue.includes(PathUtil.join(pv.basePath, pv.fileName)) ? 'lowlight' : 'normal'} />;
                }}
                projEle={(p, hc) => {
                    const ctxMenus = [
                        {
                            icon: <Folder />,
                            text: 'Show In Explorer',
                            onClick: async () => {
                                await api.call('system/open-folder', p.basePath);
                            }
                        }
                    ];
                    return <ProjItem2 v={p}
                                      ctxMenus={ctxMenus}
                                      variant={queue.includes(PathUtil.join(p.basePath, p.fileName)) ? 'lowlight' : 'normal'}
                                      onClick={() => {
                                          hc();
                                          if (!p.isFolder) {
                                              onAddToQueue(PathUtil.join(p.basePath, p.fileName));
                                          }
                                      }} />;
                }}

                className={cn('w-full h-0 flex-1 scrollbar-none')}
            />
        </div>
    );
};

export default TranscriptFile;
