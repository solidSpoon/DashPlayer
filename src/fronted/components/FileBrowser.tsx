import React, {} from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/common/utils/Util';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/fronted/components/ui/card';
import FileSelector from '@/fronted/components/fileBowser/FileSelector';
import FileItem from '@/fronted/components/fileBowser/FileItem';
import { WatchProjectType } from '@/backend/db/tables/watchProjects';
import useFile from '@/fronted/hooks/useFile';
import ProjectListComp from '@/fronted/components/fileBowser/project-list-comp';
import FolderSelecter from '@/fronted/components/fileBowser/FolderSelecter';
import { Button } from '@/fronted/components/ui/button';

const api = window.electron;
const FileBrowser = () => {
    const navigate = useNavigate();
    const pId = useFile(state => state.projectId);
    const vId = useFile(state => state.videoId);
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
                        onSelected={(vid) => {
                            navigate(`/player/${vid}`);
                        }}
                        child={(hc) => (
                            <Button
                                onClick={() => hc()}
                                variant={'outline'}
                                className={cn('w-28')}
                            >Open File</Button>
                        )}
                    />
                    <FolderSelecter
                        onSelected={(vid) => {
                            navigate(`/player/${vid}`);
                        }}
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
                            <FileItem
                                icon={'none'}
                                onClick={hc}
                                content={root ? '.' : '..'}
                            />
                        );
                    }}
                    videoEle={(pv) => {
                        return (
                            <FileItem
                                key={pv.project_id + '_' + pv.id}
                                className={cn(vId === pv.id ? 'bg-primary hover:bg-primary/90 text-primary-foreground' : '')}
                                icon={'video'}
                                onClick={async () => {
                                    navigate(`/player/${pv.id}`);
                                }}
                                content={pv.video_name}
                            />
                        );
                    }}
                    projEle={(p, hc) => {
                        return (
                            <FileItem
                                className={cn(pId === p.id ? 'bg-primary hover:bg-primary/90 text-primary-foreground' : '')}
                                key={p.id}
                                icon={p.project_type === WatchProjectType.FILE ? 'video' : 'folder'}
                                onClick={async () => {
                                    hc();
                                    if (p.project_type === WatchProjectType.FILE) {
                                        const v = await api.call('watch-project/video/detail/by-pid', p.id);
                                        navigate(`/player/${v.id}`);
                                    }
                                }}
                                content={p.project_name}
                            />
                        );
                    }}
                    className={cn('w-full h-0 flex-1 scrollbar-none')}
                />
            </CardContent>
        </Card>
    );
};

export default FileBrowser;
