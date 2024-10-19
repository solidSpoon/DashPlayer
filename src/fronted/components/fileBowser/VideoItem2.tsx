import React from 'react';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger
} from '@/fronted/components/ui/context-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import { cn } from '@/fronted/lib/utils';
import MediaUtil from '@/common/utils/MediaUtil';
import { FileAudio2, FileVideo2 } from 'lucide-react';
import Style from '@/fronted/styles/style';
import WatchHistoryVO from '@/common/types/WatchHistoryVO';
import PathUtil from '@/common/utils/PathUtil';

export interface CtxMenu {
    icon: React.ReactNode;
    text: string;
    disabled?: boolean;
    onClick: () => void;
}

export type BrowserItemVariant = 'highlight' | 'normal' | 'lowlight';

const VideoItem2 = ({ pv, variant = 'normal', ctxMenus, onClick }: {
    pv: WatchHistoryVO,
    variant?: BrowserItemVariant;
    onClick?: () => void,
    ctxMenus: CtxMenu[]
}) => {
    const [contextMenu, setContextMenu] = React.useState(false);
    return (
        <ContextMenu
            onOpenChange={(open) => {
                setContextMenu(open);
            }}
        >
            <ContextMenuTrigger>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div
                                className={cn(
                                    'w-full flex-shrink-0 flex justify-start items-center hover:bg-black/5 rounded-lg gap-3 px-3 lg:px-6 py-2',
                                    variant === 'highlight' && 'bg-primary hover:bg-primary/90 text-primary-foreground',
                                    variant === 'lowlight' && 'text-muted-foreground',
                                    contextMenu && 'bg-black/5 dark:bg-white/5'
                                )}
                                onClick={() => {
                                    onClick?.();
                                }}
                            >
                                <>
                                    {MediaUtil.isAudio(pv.fileName) &&
                                        <FileAudio2 className={cn(Style.file_browser_icon)} />}
                                    {MediaUtil.isVideo(pv.fileName) &&
                                        <FileVideo2 className={cn(Style.file_browser_icon)} />}
                                    <div className="truncate w-0 flex-1">{pv.fileName}</div>
                                </>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent
                            side={'bottom'}
                            align={'start'}
                        >
                            {PathUtil.join(pv.basePath, pv.fileName)}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </ContextMenuTrigger>
            <ContextMenuContent>
                {ctxMenus.map((item, idx) => (
                    <ContextMenuItem
                        key={idx}
                        onClick={item.onClick}
                    >{item.text}</ContextMenuItem>
                ))}
            </ContextMenuContent>
        </ContextMenu>

    );
};

export default VideoItem2;
