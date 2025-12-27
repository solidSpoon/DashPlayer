import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/fronted/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/fronted/components/ui/card';
import useFile from '@/fronted/hooks/useFile';
import ProjectListComp from '@/fronted/components/fileBowser/project-list-comp';
import { Folder, X } from 'lucide-react';
import { apiPath, swrApiMutate } from '@/fronted/lib/swr-util';
import FolderSelector, { FolderSelectAction } from '@/fronted/components/fileBowser/FolderSelector';
import FileSelector, { FileAction } from '@/fronted/components/fileBowser/FileSelector';
import VideoItem2, { BrowserItemVariant } from '@/fronted/components/fileBowser/VideoItem2';
import ProjItem2 from '@/fronted/components/fileBowser/ProjItem2';
import PathUtil from '@/common/utils/PathUtil';
import useSWR from 'swr';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import WatchHistoryVO from '@/common/types/WatchHistoryVO';
import BackNavItem from '@/fronted/components/fileBowser/BackNavItem';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';

const api = backendClient;
const logger = getRendererLogger('FileBrowser');
const FileBrowser = () => {
    const navigate = useNavigate();
    const file = useFile(state => state.videoPath);
    const videoId = useFile(state => state.videoId);
    const cardRef = useRef<HTMLDivElement>(null);
    const [showTitle, setShowTitle] = useState(true);

    const [previousData, setPreviousData] = useState<WatchHistoryVO | null>(null);

    useEffect(() => {
        const checkHeight = () => {
            setShowTitle(window.innerHeight > 800);
        };

        checkHeight();
        window.addEventListener('resize', checkHeight);
        return () => window.removeEventListener('resize', checkHeight);
    }, []);
    const { data } = useSWR(
        [apiPath('watch-history/detail'), videoId],
        ([_p, v]) => api.call('watch-history/detail', v ?? ''),
        {
            revalidateOnFocus: false,
            fallbackData: previousData,
            onSuccess: (data) => {
                setPreviousData(data);
            }
        }
    );
    return (
        <Card
            ref={cardRef}
            onClick={(e) => {
                e.stopPropagation();
            }}
            className={cn('h-full w-full flex flex-col')}
        >
            {showTitle && (
                <CardHeader className="pb-3">
                    <CardTitle>Video Explorer</CardTitle>
                    <CardDescription>Browse and play your favorite videos</CardDescription>
                </CardHeader>
            )}
            <CardContent className={cn('h-0 flex-1 w-full flex flex-col gap-2 p-4')}>
                <div
                    className={cn('flex mb-6 flex-wrap w-full justify-center items-center gap-2 min-h-20 rounded border border-dashed p-2')}
                >
                    <FileSelector
                        withMkv
                        onSelected={FileAction.playerAction(navigate)}
                    />
                    <FolderSelector
                        onSelected={FolderSelectAction.defaultAction2(async (vid, fp) => {
                            navigate(`/player/${vid}`);
                        })}
                    />
                </div>

                <ProjectListComp
                    enterProj={data?.isFolder ? data?.basePath : ''}
                    backEle={(root, currentPath, hc) => (
                        <BackNavItem
                            root={root}
                            currentPath={currentPath}
                            onClick={hc}
                        />
                    )}
                    videoEle={(pv) => {
                        let variant: BrowserItemVariant = 'normal';
                        if (file === PathUtil.join(pv.basePath, pv.fileName)) {
                            variant = 'highlight';
                        } else if (pv.current_position > 5) {
                            variant = 'lowlight';
                        }
                        return (
                            <VideoItem2
                                onClick={() => navigate(`/player/${pv.id}`)}
                                pv={pv}
                                ctxMenus={[
                                    {
                                        icon: <Folder />,
                                        text: 'Show In Explorer',
                                        onClick: async () => {
                                            await api.call('system/open-folder', pv.basePath);
                                        }
                                    }
                                ]} variant={variant} />
                        );
                    }}
                    projEle={(p, hc) => {
                        const ctxMenus = [
                            {
                                icon: <Folder />,
                                text: 'Show In Explorer',
                                onClick: async () => {
                                    await api.call('system/open-folder', p.basePath);
                                }
                            },
                            {
                                icon: <X />,
                                text: 'Delete',
                                disabled: file === PathUtil.join(p.basePath, p.fileName),
                                onClick: async () => {
                                    await api.call('watch-history/group-delete', p.id);
                                    await swrApiMutate('watch-history/list');
                                }
                            }
                        ];
                        let variant: BrowserItemVariant = 'normal';
                        if (file === PathUtil.join(p.basePath, p.fileName)) {
                            variant = 'highlight';
                        } else if (!p.isFolder && p?.current_position > 5) {
                            variant = 'lowlight';
                        }
                        return (
                            <ProjItem2 v={p}
                                       variant={variant}
                                       onClick={async () => {
                                           logger.debug('project clicked', { projectId: p.id });
                                           hc();
                                           if (!p.isFolder) {
                                               navigate(`/player/${p.id}`);
                                           }
                                       }}
                                       ctxMenus={ctxMenus} />
                        );
                    }}
                    className={cn('w-full h-0 flex-1 scrollbar-none')}
                />
            </CardContent>
        </Card>
    );
};

export default FileBrowser;
