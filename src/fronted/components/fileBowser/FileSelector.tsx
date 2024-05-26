import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import { cn } from '@/fronted/lib/utils';
import { Button } from '@/fronted/components/ui/button';
import MediaUtil, {
    AllFormats,
    SupportedFormats,
    UnsupportedVideoFormats
} from '@/common/utils/MediaUtil';
import useFile from '@/fronted/hooks/useFile';
import { strNotBlank } from '@/common/utils/Util';
import { SWR_KEY, swrMutate } from '@/fronted/lib/swr-util';
import useLayout from '@/fronted/hooks/useLayout';
import useConvert from '@/fronted/hooks/useConvert';
import { toast } from 'sonner';

const api = window.electron;

export class FileAction {

    public static playerAction(navigate: (s: string) => void) {
        return async (ps: string[]) => {
            if (ps.length === 1 && MediaUtil.isSrt(ps[0])) {
                const videoPath = useFile.getState().videoPath;
                if (strNotBlank(videoPath)) {
                    await api.call('watch-project/attach-srt', { videoPath, srtPath: ps[0] });
                    useFile.getState().clearSrt();
                }
            } else {
                const pid = await api.call('watch-project/create/from-files', ps);
                const v = await api.call('watch-project/video/detail/by-pid', pid);
                await api.call('system/window-size/change', 'player');
                navigate(`/player/${v.id}`);
                const hasUnsupported = UnsupportedVideoFormats.some(f => ps.some(p => p.endsWith(f)));
                if (hasUnsupported) {
                    const vs = ps.filter(p => MediaUtil.isMedia(p));
                    setTimeout(() => {
                        toast('MKV 格式的的视频可能会遇到问题', {
                            description: '如果您遇到问题，请尝试转换视频格式',
                            position: 'top-right',
                            action: {
                                label: 'Convert',
                                onClick: () => {
                                    useConvert.getState().addFiles(vs);
                                    navigate(`/convert`);
                                }
                            }
                        });
                    }, 500);
                }
            }
            await swrMutate(SWR_KEY.PLAYER_P);
            await swrMutate(SWR_KEY.WATCH_PROJECT_LIST);
            await swrMutate(SWR_KEY.WATCH_PROJECT_DETAIL);
        };

    }

    public static playerAction2(navigate: (s: string) => void) {
        return async (ps: string[]) => {
            if (ps.length === 1 && MediaUtil.isSrt(ps[0])) {
                const videoPath = useFile.getState().videoPath;
                if (strNotBlank(videoPath)) {
                    await api.call('watch-project/attach-srt', { videoPath, srtPath: ps[0] });
                    useFile.getState().clearSrt();
                }
            } else {
                const pid = await api.call('watch-project/create/from-files', ps);
                const v = await api.call('watch-project/video/detail/by-pid', pid);
                await api.call('system/window-size/change', 'player');
                useLayout.getState().changeSideBar(false);
                navigate(`/player/${v.id}`);

                const hasUnsupported = UnsupportedVideoFormats.some(f => ps.some(p => p.endsWith(f)));
                if (hasUnsupported) {
                    const vs = ps.filter(p => MediaUtil.isMedia(p));
                    setTimeout(() => {
                        toast('MKV 格式的的视频可能会遇到问题', {
                            description: '如果您遇到问题，请尝试转换视频格式',
                            position: 'top-right',
                            action: {
                                label: 'Convert',
                                onClick: () => {
                                    useConvert.getState().addFiles(vs);
                                    navigate(`/convert`);
                                }
                            }
                        });
                    }, 500);
                }
            }
            await swrMutate(SWR_KEY.PLAYER_P);
            await swrMutate(SWR_KEY.WATCH_PROJECT_LIST);
            await swrMutate(SWR_KEY.WATCH_PROJECT_DETAIL);
        };

    }
}

export default function FileSelector({
                                         onSelected,
                                         withMkv
                                     }: {
    onSelected: (ps: string[]) => Promise<void>;
    withMkv?: boolean;
}) {
    const handleClick = async () => {
        const ps = await api.call('system/select-file', withMkv ? AllFormats : SupportedFormats);
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
FileSelector.defaultProps = {
    withMkv: false
};
