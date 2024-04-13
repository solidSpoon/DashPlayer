import React from 'react';
import { useNavigate } from 'react-router-dom';
import { pathToFile } from '../../../common/utils/FileParser';
import useFile from '../../hooks/useFile';
import { cn } from '../../../common/utils/Util';
import usePlayerController from '../../hooks/usePlayerController';
import FileItem from './FileItem';
import { isMidea, isSrt } from '@/common/utils/MediaTypeUitl';
import { WatchProjectVO } from '@/backend/services/WatchProjectNewService';
import { mutate } from 'swr';

export interface OpenFileProps {
    directory?: boolean;
    className?: string;
    onSelected?: () => void;
}

const api = window.electron;

export default function FileSelector({
                                         directory,
                                         className,
                                         onSelected
                                     }: OpenFileProps) {
    const navigate = useNavigate();
    const handleClick = async () => {
        const ps = await api.call('system/select-file', {
            mode: directory ? 'directory' : 'file',
            filter: 'none'
        });
        console.log('project', ps);
        if (ps.length === 1 && !directory && isSrt(ps[0])) {
            const video = useFile.getState().videoFile;
            if (video?.path) {
                await api.call('watch-project/attach-srt', { videoPath: video.path, srtPath: ps[0] });
            }
            return;
        }

        const [videoFile] = ps.filter((p) => isMidea(p));
        const [subtitleFile] = ps.filter((p) => isSrt(p));
        const pid = await api.call('watch-project/create/from-files', [videoFile, subtitleFile]);
        const watchProject: WatchProjectVO = await api.call('watch-project/detail', pid);
        let [video] = watchProject.videos.filter(v => v.current_playing);
        if (!video) {
            video = watchProject.videos[0];
        }
        await api.playerSize();
        console.log('jump', `/player/${video.id}`);
        navigate(`/player/${video.id}`);
        await mutate('player-p');
        onSelected?.();
    };

    return (
        <>
            {directory && (
                <FileItem
                    content="打开文件夹..."
                    className={cn('w-full', className)}
                    onClick={() => handleClick()}
                />
            )}
            {!directory && (
                <FileItem
                    content="打开文件..."
                    tip="打开文件，可多选（同时选择视频和对应的字幕）"
                    className={cn('w-full', className)}
                    onClick={() => handleClick()}
                />
            )}
        </>
    );
}

FileSelector.defaultProps = {
    directory: false,
    className: '',
    onSelected: () => {
        //
    }
};
