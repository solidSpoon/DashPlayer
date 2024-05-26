import React from 'react';
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/fronted/components/ui/tooltip';
import {cn} from "@/fronted/lib/utils";
import {Button} from "@/fronted/components/ui/button";
import { UnsupportedVideoFormats } from '@/common/utils/MediaUtil';

const api = window.electron;

export default function ConvertFileSelector({
                                         onSelected
                                     }: {
    onSelected: (ps: string[]) => Promise<void>;
}) {
    const handleClick = async () => {
        const ps = await api.call('system/select-file', UnsupportedVideoFormats);
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
                        className={cn('w-28')}
                    >Add File</Button>
                </TooltipTrigger>
                <TooltipContent>
                    可以同时选择一个视频文件及其对应的字幕文件
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
