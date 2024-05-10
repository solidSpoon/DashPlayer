import { SWR_KEY, swrMutate } from '@/fronted/lib/swr-util';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import React from 'react';
import {emptyFunc} from "@/common/utils/Util";
import {cn} from "@/fronted/lib/utils";
import {Button} from "@/fronted/components/ui/button";

const api = window.electron;

export interface FolderSelecterProps {
    onSelected?: (vid: number) => void;
    className?: string;
}

const FolderSelector = ({onSelected, className}:FolderSelecterProps) => {
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
                    <Button
                        onClick={() => handleClick()}
                        variant={'outline'}
                        className={cn('w-28', className)}
                    >Open Folder</Button>
                </TooltipTrigger>
                <TooltipContent>
                    文件夹内的视频和对应的字幕文件名称最好保持一致
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

FolderSelector.defaultProps = {
    onSelected: emptyFunc,
    className: ''
}

export default FolderSelector;
