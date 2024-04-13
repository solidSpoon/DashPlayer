import React from 'react';
import { useNavigate } from 'react-router-dom';
import useFile from '../../hooks/useFile';
import { cn } from '@/common/utils/Util';
import { Button } from '@/fronted/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import { isMidea, isSrt } from '@/common/utils/MediaTypeUitl';
import { WatchProjectVO } from '@/backend/services/WatchProjectNewService';
import { mutate } from 'swr';

export interface OpenFileProps {
    directory?: boolean;
    className?: string;
    onSelected?: () => void;
}

const api = window.electron;

export default function FileSelector2({
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
        let [video] = watchProject.videos.filter(v=>v.current_playing);
        if (!video) {
            video = watchProject.videos[0];
        }
        await api.playerSize();
        navigate(`/player/${video.id}`);
        await mutate('player-p');
        onSelected?.();
    };

    return (
        <>
            {directory && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                onClick={() => handleClick()}
                                variant={'outline'}
                                className={cn('w-28')}
                            >Open Folder</Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            文件夹内的视频和对应的字幕文件名称最好保持一致
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

            )}
            {!directory && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                onClick={() => handleClick()}
                                variant={'outline'}
                                className={cn('w-28')}
                            >Open File</Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            可以同时选择一个视频文件及其对应的字幕文件
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
        </>
    );
}

FileSelector2.defaultProps = {
    directory: false,
    className: '',
    onSelected: () => {
        //
    }
};
