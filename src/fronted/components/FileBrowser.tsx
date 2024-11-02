import React from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/fronted/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/fronted/components/ui/card';
import useFile from '@/fronted/hooks/useFile';
import ProjectListComp from '@/fronted/components/fileBowser/project-list-comp';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import { Folder, X } from 'lucide-react';
import { apiPath, SWR_KEY, swrMutate } from '@/fronted/lib/swr-util';
import FolderSelector, { FolderSelectAction } from '@/fronted/components/fileBowser/FolderSelector';
import FileSelector, { FileAction } from '@/fronted/components/fileBowser/FileSelector';
import VideoItem2, { BrowserItemVariant } from '@/fronted/components/fileBowser/VideoItem2';
import ProjItem2 from '@/fronted/components/fileBowser/ProjItem2';
import { toast } from 'sonner';
import useConvert from '@/fronted/hooks/useConvert';
import PathUtil from '@/common/utils/PathUtil';
import useSWR from 'swr';

const api = window.electron;
const FileBrowser = () => {
    const navigate = useNavigate();
    const file = useFile(state => state.videoPath);
    const videoId = useFile(state => state.videoId);
    const { data } = useSWR([apiPath('watch-history/detail'), videoId],([_p,v])=> api.call('watch-history/detail', v??''),{fallbackData: null});
    console.log('file', data);
    return (
        <Card
            onClick={(e) => {
                e.stopPropagation();
            }}
            className={cn('h-full w-full flex flex-col')}
        >
            <CardHeader>
                <CardTitle>Video Explorer</CardTitle>
                <CardDescription>Browse and play your favorite videos</CardDescription>
            </CardHeader>
            <CardContent className={cn('h-0 flex-1 w-full flex flex-col gap-2')}>
                <div
                    className={cn('justify-self-end flex mb-10 flex-wrap w-full justify-center items-center gap-2 min-h-20 rounded border border-dashed p-2')}
                >
                    <FileSelector
                        withMkv
                        onSelected={FileAction.playerAction(navigate)}
                    />
                    <FolderSelector
                        onSelected={FolderSelectAction.defaultAction2(async (vid, fp) => {
                            navigate(`/player/${vid}`);
                            const analyse = await api.call('watch-history/analyse-folder', fp);
                            if (analyse?.unsupported > 0) {
                                const folderList = await api.call('convert/from-folder', [fp]);
                                setTimeout(() => {
                                    toast('MKV 格式的的视频可能会遇到问题', {
                                        description: '如果您遇到问题，请尝试转换视频格式',
                                        position: 'top-right',
                                        action: {
                                            label: 'Convert',
                                            onClick: () => {
                                                useConvert.getState().addFolders(folderList);
                                                navigate(`/convert`);
                                            }
                                        }
                                    });
                                }, 500);
                            }
                        })}
                    />
                </div>

                <ProjectListComp
                    enterProj={data?.isFolder ? data?.basePath : ''}
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
                        let variant: BrowserItemVariant = 'normal';
                        if (file === PathUtil.join(pv.basePath, pv.fileName)) {
                            variant = 'highlight';
                        } else if (pv.duration > 5) {
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
                                    await api.call('watch-history/delete', p.id);
                                    await swrMutate(SWR_KEY.WATCH_PROJECT_LIST);
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
                                           console.log('click', p.id);
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
