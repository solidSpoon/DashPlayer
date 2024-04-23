import useSWR from 'swr';
import { cn } from '@/common/utils/Util';
import { GoHistory } from 'react-icons/go';
import FileItem from '@/fronted/components/fileBowser/FileItem';
import React from 'react';
import { WatchProject, WatchProjectType } from '@/backend/db/tables/watchProjects';
import { SWR_KEY, swrMutate } from '@/fronted/lib/swr-util';
import { Trash2 } from 'lucide-react';
import { Button } from '@/fronted/components/ui/button';

const api = window.electron;


const ProjectListCard = ({ proj, onSelected }: {
    proj: WatchProject,
    className?: string
    onSelected: () => void;
}) => {
    const { data: video } = useSWR(['watch-project/video/detail/by-pid', proj.id], ([key, projId]) => api.call('watch-project/video/detail/by-pid', projId));

    const { data: url } = useSWR(video ?
            [SWR_KEY.SPLIT_VIDEO_THUMBNAIL, video.video_path, video.current_time] : null,
        async ([key, path, time]) => {
            return await api.call('split-video/thumbnail', { filePath: path, time });
        }
    );
    const [hover, setHover] = React.useState(false);
    return (
        <div
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            className={cn('relative')}
            onClick={onSelected}
        >
            {hover && (
                <Button
                    className={'absolute top-2 right-2 w-6 h-6 bg-background z-50'}
                    size={'icon'}
                    variant={'ghost'}
                    onClick={async (e) => {
                        e.stopPropagation();
                        console.log('swrdelete', proj.id);
                        await api.call('watch-project/delete', proj.id);
                        await swrMutate(SWR_KEY.WATCH_PROJECT_LIST);
                    }}
                    >
                    <Trash2
                        className={'w-3 h-3'}
                    />
                </Button>

            )}
            <img
                src={url}
                style={{
                    aspectRatio: '16/9'
                }}
                className={cn("w-full object-cover rounded-lg", hover && 'filter brightness-75')}
                alt={proj.project_name}
            />
            <div
                className={cn('w-full line-clamp-2 break-words', hover && 'underline')}
            >{proj.project_name}</div>
        </div>

    );
};

export default ProjectListCard;
