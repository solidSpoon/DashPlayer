import { SWR_KEY, swrMutate } from '@/fronted/lib/swr-util';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import React from 'react';
import { emptyFunc } from '@/common/utils/Util';
import { cn } from '@/fronted/lib/utils';
import { Button } from '@/fronted/components/ui/button';

const api = window.electron;

export interface FolderSelectorProps {
    onSelected?: (fp: string) => void;
    className?: string;
}

export class FolderSelectAction {
    public static defaultAction(onSelected?: (vid: string) => void) {
        return async (fp: string) => {
            const [id] = await api.call('watch-history/create', [fp]);
            onSelected?.(id);
            await swrMutate(SWR_KEY.PLAYER_P);
            await swrMutate(SWR_KEY.WATCH_PROJECT_LIST);
            await swrMutate(SWR_KEY.WATCH_PROJECT_DETAIL);
        };
    }
    public static defaultAction2(onSelected: (vid: string, fp: string) => void) {
        return async (fp: string) => {
            const [id] = await api.call('watch-history/create', [fp]);
            onSelected(id, fp);
            await swrMutate(SWR_KEY.PLAYER_P);
            await swrMutate(SWR_KEY.WATCH_PROJECT_LIST);
            await swrMutate(SWR_KEY.WATCH_PROJECT_DETAIL);
        };
    }
}

const FolderSelector = ({ onSelected, className }: FolderSelectorProps) => {
    const handleClick = async () => {
        const ps = await api.call('system/select-folder',{});
        console.log('project', ps);
        if (ps.length > 0) {
            onSelected?.(ps[0]);
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
};

export default FolderSelector;
