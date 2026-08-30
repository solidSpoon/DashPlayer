import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import { cn } from '@/fronted/lib/utils';
import { Button } from '@/fronted/components/ui/button';
import MediaUtil, {
    AllFormats,
    SupportedFormats,
} from '@/common/utils/MediaUtil';
import useFile from '@/fronted/features/file-browser/fileStore';
import { SWR_KEY, swrApiMutate, swrMutate } from '@/fronted/lib/swr-util';
import useLayout from '@/fronted/hooks/useLayout';
import StrUtil from '@/common/utils/str-util';
import { fileBrowserApi } from '@/fronted/features/file-browser/fileBrowserApi';
import { useTranslation } from 'react-i18next';
import { FileVideo } from 'lucide-react';

export class FileAction {

    public static playerAction(navigate: (s: string) => void) {
        return async (ps: string[]) => {
            if (ps.length === 1 && MediaUtil.isSubtitle(ps[0])) {
                const videoPath = useFile.getState().videoPath;
                if (StrUtil.isNotBlank(videoPath)) {
                    await fileBrowserApi.attachSubtitle(videoPath, ps[0]);
                    useFile.getState().clearSrt();
                }
            } else {
                // 格式兼容性引导统一由播放页负责（乐观播放 + 失败/无声检测），这里不再预检
                const [id] = await fileBrowserApi.createWatchHistory(ps);
                await fileBrowserApi.changeWindowSize('player');
                navigate(`/player/${id}`);
            }
            await swrMutate(SWR_KEY.PLAYER_P);
            await swrApiMutate('watch-history/list');
            await swrMutate(SWR_KEY.WATCH_PROJECT_DETAIL);
        };

    }

    public static playerAction2(navigate: (s: string) => void) {
        return async (ps: string[]) => {
            if (ps.length === 1 && MediaUtil.isSubtitle(ps[0])) {
                const videoPath = useFile.getState().videoPath;
                if (StrUtil.isNotBlank(videoPath)) {
                    await fileBrowserApi.attachSubtitle(videoPath, ps[0]);
                    useFile.getState().clearSrt();
                }
            } else {
                const [id] = await fileBrowserApi.createWatchHistory(ps);
                await fileBrowserApi.changeWindowSize('player');
                useLayout.getState().changeSideBar(false);
                navigate(`/player/${id}`);
            }
            await swrMutate(SWR_KEY.PLAYER_P);
            await swrApiMutate('watch-history/list');
            await swrMutate(SWR_KEY.WATCH_PROJECT_DETAIL);
        };

    }
}

export default function FileSelector({
                                         onSelected,
                                         withMkv,
                                         className
                                     }: {
    onSelected: (ps: string[]) => Promise<void>;
    withMkv?: boolean;
    className?: string;
}) {
    const { t } = useTranslation('common');
    const handleClick = async () => {
        const ps = await fileBrowserApi.selectFiles(withMkv ? AllFormats : SupportedFormats);
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
                        className={cn('w-full rounded-xl flex items-center justify-center gap-2 h-10', className)}
                    >
                        <FileVideo className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>{t('openFile')}</span>
                    </Button>
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
