import React from 'react';
import { cn } from '@/fronted/lib/utils';
import ProjectListComp from '@/fronted/components/feature/file-browser/project-list-comp';
import { Folder } from 'lucide-react';
import { SWR_KEY, swrApiMutate, swrMutate } from '@/fronted/lib/swr-util';
import MediaUtil from '@/common/utils/MediaUtil';
import useTranscript from '@/fronted/hooks/useTranscript';
import { useShallow } from 'zustand/react/shallow';
import FolderSelector, { FolderSelectAction } from '@/fronted/components/feature/file-browser/FolderSelector';
import FileSelector from '@/fronted/components/feature/file-browser/FileSelector';
import ProjItem2 from '@/fronted/components/feature/file-browser/ProjItem2';
import VideoItem2 from '@/fronted/components/feature/file-browser/VideoItem2';
import StrUtil from '@/common/utils/str-util';
import PathUtil from '@/common/utils/PathUtil';
import BackNavItem from '@/fronted/components/feature/file-browser/BackNavItem';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';

const api = backendClient;
const TranscriptFile = () => {
    const { files, onAddToQueue, onTranscript } = useTranscript(useShallow(s => ({
        files: s.files,
        onAddToQueue: s.onAddToQueue,
        onTranscript: s.onTranscript
    })));
    
    const handleFileClick = async (p: string) => {
        const isFirst = files.length === 0;
        onAddToQueue(p);
        if (isFirst) {
            // 如果是第一个文件，自动开始转录
            await onTranscript(p);
        }
    };
    const queue = files.map(f => f.file);
    return (
        <div className={cn('flex-1 flex flex-col rounded-lg border bg-muted/20 p-4 min-h-0')}>
            <div
                className={cn('flex flex-wrap w-full justify-center items-center gap-2 min-h-14 rounded-lg border border-dashed p-2 mb-3')}
            >
                <FileSelector onSelected={async (ps) => {
                    const vp = ps.find(MediaUtil.isMedia);
                    const sp = ps.find(MediaUtil.isSrt);
                    if (vp) {
                        await api.call('watch-history/create', ps);
                        // 也可以考虑在这里 handleFileClick
                        await handleFileClick(vp);
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
                                           handleFileClick(PathUtil.join(pv.basePath, pv.fileName));
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
                                              handleFileClick(PathUtil.join(p.basePath, p.fileName));
                                          }
                                      }} />;
                }}

                className={cn('w-full h-0 flex-1 scrollbar-none')}
            />
        </div>
    );
};

export default TranscriptFile;
