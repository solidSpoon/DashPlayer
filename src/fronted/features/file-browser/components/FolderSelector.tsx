import { SWR_KEY, swrApiMutate, swrMutate } from '@/fronted/lib/swr-util';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import React from 'react';
import { emptyFunc } from '@/common/utils/Util';
import { cn } from '@/fronted/lib/utils';
import { Button } from '@/fronted/components/ui/button';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { fileBrowserApi } from '@/fronted/features/file-browser/fileBrowserApi';
import { useTranslation } from 'react-i18next';

const logger = getRendererLogger('FolderSelector');

export interface FolderSelectorProps {
    onSelected?: (fp: string) => void;
    className?: string;
}

export class FolderSelectAction {
    public static defaultAction(onSelected?: (vid: string) => void) {
        return async (fp: string) => {
            const [id] = await fileBrowserApi.createWatchHistory([fp]);
            onSelected?.(id);
            await swrMutate(SWR_KEY.PLAYER_P);
            await swrApiMutate('watch-history/list');
            await swrMutate(SWR_KEY.WATCH_PROJECT_DETAIL);
        };
    }

    public static defaultAction2(onSelected: (vid: string, fp: string) => void) {
        return async (fp: string) => {
            const [id] = await fileBrowserApi.createWatchHistory([fp]);
            logger.debug('Created watch history', { id });
            onSelected(id, fp);
            await swrMutate(SWR_KEY.PLAYER_P);
            await swrApiMutate('watch-history/list');
            await swrMutate(SWR_KEY.WATCH_PROJECT_DETAIL);
        };
    }
}

const FolderSelector = ({ onSelected, className }: FolderSelectorProps) => {
    const { t } = useTranslation('common');
    const handleClick = async () => {
        const ps = await fileBrowserApi.selectFolder({});
        logger.debug('Selected folder projects', { projectCount: ps.length, firstProject: ps[0] });
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
                    >{t('openFolder')}</Button>
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
