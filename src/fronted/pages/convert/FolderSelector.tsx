import { SWR_KEY, swrMutate } from '@/fronted/lib/swr-util';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import React from 'react';
import {emptyFunc} from "@/common/utils/Util";
import {cn} from "@/fronted/lib/utils";
import {Button} from "@/fronted/components/ui/button";

const api = window.electron;

export interface FolderSelectorProps {
    onSelected?: (folders: string[]) => void;
    className?: string;
}

const ConvertFolderSelector = ({onSelected, className}:FolderSelectorProps) => {
    const handleClick = async () => {
        const ps = await api.call('system/select-folder', null);
        if (ps?.length > 0) {
            await onSelected(ps);
        }
    };

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        onClick={() => handleClick()}
                        variant={'outline'}
                        className={cn('w-28', className)}
                    >Add Folder</Button>
                </TooltipTrigger>
                <TooltipContent>
                    文件夹内的视频和对应的字幕文件名称最好保持一致
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

ConvertFolderSelector.defaultProps = {
    onSelected: emptyFunc,
    className: ''
}

export default ConvertFolderSelector;
