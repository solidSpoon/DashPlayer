import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/fronted/lib/utils';
import useLayout from '@/fronted/hooks/useLayout';
import { useSubtitleScrollState } from '@/fronted/features/player/hooks/useSubtitleScroll';
import { swrApiMutate } from '@/fronted/lib/swr-util';
import { useHotkeys } from 'react-hotkeys-hook';
import { Button } from '@/fronted/components/ui/button';
import useSetting from '@/fronted/features/settings/settingsStore';
import { LayoutGrid } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';

const process = (values: string) => values
    .split(',')
    .map((k) => k.replaceAll(' ', ''))
    .filter((k) => k !== '')
    // remove left right up down space
    .filter((k) => k !== 'left' && k !== 'right' && k !== 'up' && k !== 'down' && k !== 'space');

/**
 * 渲染控制面板悬浮按钮，并绑定打开控制面板快捷键。
 */
export default function ControlButton() {
    const changeSideBar = useLayout((s) => s.changeSideBar);
    const showSideBar = useLayout((s) => s.showSideBar);
    const pauseMeasurement = useSubtitleScrollState((state) => state.pauseMeasurement);
    const fullScreen = useLayout(s => s.fullScreen);
    const openControlPanelShortcut = useSetting((s) => s.values.get('shortcut.openControlPanel') ?? '');

    useHotkeys(process(openControlPanelShortcut), () => {
        changeSideBar(!showSideBar);
    }, [changeSideBar, showSideBar]);

    return (
        <AnimatePresence>
            {!fullScreen && (
                <motion.div
                    className="fixed bottom-8 right-8 z-[99]"
                    transition={{
                        delay: 0.15,
                        duration: 0.2,
                    }}
                    initial={{
                        scale: 0,
                        opacity: 0,
                    }}
                    animate={{
                        scale: 1,
                        opacity: 1,
                    }}
                    exit={{
                        scale: 0,
                        opacity: 0,
                    }}
                >
                    <TooltipProvider delayDuration={300}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    size="icon"
                                    onClick={async () => {
                                        await swrApiMutate('watch-history/list');
                                        pauseMeasurement();
                                        changeSideBar(!showSideBar);
                                    }}
                                    className={cn(
                                        'w-10 h-10 rounded-full border shadow-lg transition-all duration-200',
                                        // 基础与深浅色毛玻璃材质
                                        'bg-stone-900/85 text-stone-100 border-white/15 backdrop-blur-xl',
                                        'hover:bg-stone-900 hover:scale-105 hover:shadow-xl active:scale-95',
                                        'dark:bg-neutral-100/90 dark:text-neutral-900 dark:border-black/10 dark:hover:bg-neutral-100',
                                        // 未悬停时适度半透，减少播放视觉干扰
                                        'opacity-75 hover:opacity-100'
                                    )}
                                    aria-label="打开控制面板"
                                >
                                    <LayoutGrid className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="text-xs">
                                {showSideBar ? '收起控制面板' : '打开控制面板'}
                                {openControlPanelShortcut ? ` (${openControlPanelShortcut})` : ''}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
