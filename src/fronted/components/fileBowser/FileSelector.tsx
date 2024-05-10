import React from 'react';
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/fronted/components/ui/tooltip';
import {cn} from "@/fronted/lib/utils";
import {Button} from "@/fronted/components/ui/button";
import MediaUtil from "@/common/utils/MediaUtil";
import useFile from "@/fronted/hooks/useFile";
import {strNotBlank} from "@/common/utils/Util";
import {SWR_KEY, swrMutate} from "@/fronted/lib/swr-util";

const api = window.electron;
export class FileAction {

    public static playerAction(onSelected: (vid: number) => Promise<void>) {
        return async (ps: string[]) => {
            if (ps.length === 1 && MediaUtil.isSrt(ps[0])) {
                const videoPath = useFile.getState().videoPath;
                if (strNotBlank(videoPath)) {
                    await api.call('watch-project/attach-srt', {videoPath, srtPath: ps[0]});
                    useFile.getState().clearSrt();
                }
            } else {
                const pid = await api.call('watch-project/create/from-files', ps);
                const v = await api.call('watch-project/video/detail/by-pid', pid);
                await api.call('system/window-size/change', 'player');
                await onSelected(v.id);
            }
            await swrMutate(SWR_KEY.PLAYER_P);
            await swrMutate(SWR_KEY.WATCH_PROJECT_LIST);
            await swrMutate(SWR_KEY.WATCH_PROJECT_DETAIL);
        }
    }
}
export default function FileSelector({
                                         onSelected
                                     }: {
    onSelected: (ps: string[]) => Promise<void>;
}) {
    const handleClick = async () => {
        const ps = await api.call('system/select-file', {
            mode: 'file',
            filter: 'none'
        });
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
                    >Open File</Button>
                </TooltipTrigger>
                <TooltipContent>
                    可以同时选择一个视频文件及其对应的字幕文件
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
