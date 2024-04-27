import { useNavigate } from 'react-router-dom';
import { isSrt } from '@/common/utils/MediaUtil';
import useFile from '@/fronted/hooks/useFile';
import { SWR_KEY, swrMutate } from '@/fronted/lib/swr-util';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import React from 'react';

const api = window.electron;

export interface FolderSelecterProps {
    child: (handleClick: () => void) => React.ReactNode;
    onSelected?: (vid: number) => void;
}

const FolderSelecter = ({child, onSelected}:FolderSelecterProps) => {
    const handleClick = async () => {
        const ps = await api.call('system/select-file', {
            mode: 'directory',
            filter: 'none'
        });
        console.log('project', ps);
        const pid = await api.call('watch-project/create/from-folder', ps[0]);
        const v = await api.call('watch-project/video/detail/by-pid', pid);
        onSelected(v.id);
        await swrMutate(SWR_KEY.PLAYER_P);
        await swrMutate(SWR_KEY.WATCH_PROJECT_LIST);
        await swrMutate(SWR_KEY.WATCH_PROJECT_DETAIL);
    };

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    {child(handleClick)}
                </TooltipTrigger>
                <TooltipContent>
                    文件夹内的视频和对应的字幕文件名称最好保持一致
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

FolderSelecter.defaultProps = {
    onSelected: () => {
        //
    }
}

export default FolderSelecter;
