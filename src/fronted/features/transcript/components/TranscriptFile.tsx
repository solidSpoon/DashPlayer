import React from 'react';
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
import i18n from '@/fronted/i18n';

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
        <div className="flex-1 flex flex-col h-full min-h-0 rounded-2xl border border-border/70 bg-card p-3 overflow-hidden shadow-2xs">
            {/* 顶部快速选择按钮 */}
            <div className="flex items-center gap-2 pb-3 border-b border-border/50">
                <div className="flex-1 min-w-0">
                    <FileSelector
                        onSelected={async (ps) => {
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
                        }}
                    />
                </div>
                <div className="flex-1 min-w-0">
                    <FolderSelector onSelected={FolderSelectAction.defaultAction()} />
                </div>
            </div>

            {/* 最近浏览列表 */}
            <div className="flex-1 min-h-0 pt-2 overflow-hidden">
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
                                text: i18n.t('common:showInExplorer'),
                                onClick: async () => {
                                    await transcriptApi.openFolder(pv.basePath);
                                }
                            }
                        ];
                        const isEnqueued = queue.has(PathUtil.join(pv.basePath, pv.fileName));
                        return (
                            <VideoItem2
                                pv={pv}
                                ctxMenus={ctxMenus}
                                onClick={() => {
                                    void onEnqueue(PathUtil.join(pv.basePath, pv.fileName));
                                }}
                                variant={isEnqueued ? 'lowlight' : 'normal'}
                            />
                        );
                    }}
                    projEle={(p, hc) => {
                        const ctxMenus = [
                            {
                                icon: <Folder />,
                                text: i18n.t('common:showInExplorer'),
                                onClick: async () => {
                                    await transcriptApi.openFolder(p.basePath);
                                }
                            }
                        ];
                        const isEnqueued = queue.has(PathUtil.join(p.basePath, p.fileName));
                        return (
                            <ProjItem2
                                v={p}
                                ctxMenus={ctxMenus}
                                variant={isEnqueued ? 'lowlight' : 'normal'}
                                onClick={() => {
                                    hc();
                                    if (!p.isFolder) {
                                        void onEnqueue(PathUtil.join(p.basePath, p.fileName));
                                    }
                                }}
                            />
                        );
                    }}
                    className="w-full h-full scrollbar-none"
                />
            </div>
        </div>
    );
};

export default TranscriptFile;
