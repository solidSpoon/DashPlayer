import React, { } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/common/utils/Util';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/fronted/components/ui/card';
import FileSelector2 from '@/fronted/components/fileBowser/FileSelector2';
import FileItem from '@/fronted/components/fileBowser/FileItem';
import { WatchProjectType } from '@/backend/db/tables/watchProjects';
import useFile from '@/fronted/hooks/useFile';
import ProjectListComp from '@/fronted/components/fileBrowserNew/project-list-comp';

const api = window.electron;
const FileBrowser = () => {
    const navigate = useNavigate();
    const [pId, setPId] = React.useState<number>(useFile.getState().projectId);
    const [vId, setVId] = React.useState<number>(useFile.getState().videoId);
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
                    <FileSelector2
                        directory={false}
                    />
                    <FileSelector2
                        directory={true}
                    />
                </div>

                <ProjectListComp
                    videoEle={(pv) => {
                        return (
                            <FileItem
                                key={pv.project_id+'_'+pv.id}
                                className={cn(vId === pv.id ? 'bg-primary hover:bg-primary/90 text-primary-foreground' : '')}
                                icon={'video'}
                                onClick={async() => {
                                    setPId(pv.project_id);
                                    setVId(pv.id);
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
                                        setVId(v.id);
                                        setPId(p.id);
                                    } else {
                                        // setPId(p.id);
                                    }
                                }}
                                content={p.project_name}
                            />
                        );
                    }}
                    className={cn('w-full h-0 flex-1 overflow-y-auto scrollbar-none')} />
            </CardContent>
        </Card>
    );
};

export default FileBrowser;
