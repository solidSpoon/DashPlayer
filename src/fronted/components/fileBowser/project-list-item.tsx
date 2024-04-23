import useSWR from 'swr';
import {cn} from '@/common/utils/Util';
import {GoHistory} from 'react-icons/go';
import FileItem from '@/fronted/components/fileBowser/FileItem';
import React from 'react';
import {WatchProject, WatchProjectType} from '@/backend/db/tables/watchProjects';
import {SWR_KEY} from '@/fronted/lib/swr-util';

const api = window.electron;
const fetcher = () => api.call('watch-project/list', null);

export interface ProjectListProps {
    onSelected: (projectId: number) => void;
    className?: string;
}

const ProjectListItem = ({proj}: {
    proj: WatchProject,
    className?: string
}) => {
    const {data: video} = useSWR(['watch-project/video/detail/by-pid', proj.id], ([key, projId]) => api.call('watch-project/video/detail/by-pid', projId));

    const {data: url} = useSWR(video ?
            [SWR_KEY.SPLIT_VIDEO_THUMBNAIL, video.video_path, video.current_time] : null,
        async ([key, path, time]) => {
            return await api.call('split-video/thumbnail', {filePath: path, time});
        }
    );
    console.log('url', url);
    return (
        <div>
            <img
                src={url}
                style={{
                    aspectRatio: '16/9'
                }}
                className="w-full object-cover rounded-lg"
                alt={proj.project_name}
            />
            <div>{proj.project_name}</div>
        </div>

    );
}

export default ProjectListItem;
