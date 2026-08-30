import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/fronted/lib/utils';
import useLayout from '@/fronted/hooks/useLayout';
import { useSubtitleScrollState } from '@/fronted/features/player/hooks/useSubtitleScroll';
import { swrApiMutate } from '@/fronted/lib/swr-util';
import { useHotkeys } from 'react-hotkeys-hook';
import useSetting from '@/fronted/features/settings/settingsStore';
import { LayoutGrid, LocateFixed } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';

const process = (values: string) => values
    .split(',')
    .map((k) => k.replaceAll(' ', ''))
    .filter((k) => k !== '')
    // remove left right up down space
    .filter((k) => k !== 'left' && k !== 'right' && k !== 'up' && k !== 'down' && k !== 'space');

/**
 * 悬浮控制按钮群：
 * 1. 打开/收起控制面板主按钮（常驻底部，z-20）
 * 2. 定位到当前行按钮（z-10）：
 *    - 出现：从主按钮中心向上弹簧跳跃而出（y: 50 -> y: 0）
 *    - 消失：以强力位移下坠缩回主按钮背后中心（y: 0 -> y: 50, scale: 0.1），并在最后 10% 才淡出，确保人眼能完整清晰看到缩回动效
 */
export default function ControlButton() {
    const changeSideBar = useLayout((s) => s.changeSideBar);
    const showSideBar = useLayout((s) => s.showSideBar);
    const pauseMeasurement = useSubtitleScrollState((state) => state.pauseMeasurement);
    const scrollState = useSubtitleScrollState((state) => state.scrollState);
    const onUserFinishScrolling = useSubtitleScrollState((state) => state.onUserFinishScrolling);
    const fullScreen = useLayout((s) => s.fullScreen);
    const openControlPanelShortcut = useSetting((s) => s.values.get('shortcut.openControlPanel') ?? '');

    const isBrowsing = !showSideBar && scrollState === 'USER_BROWSING';

    useHotkeys(process(openControlPanelShortcut), () => {
        changeSideBar(!showSideBar);
    }, [changeSideBar, showSideBar]);

    return (
        <TooltipProvider delayDuration={300}>
            <AnimatePresence>
                {!fullScreen && (
                    <div className="fixed bottom-8 right-8 z-[99] pointer-events-none flex flex-col items-center justify-end select-none w-12 h-28">
                        {/* 2. 定位到当前行按钮（位于 z-10，在主按钮之后） */}
                        <AnimatePresence>
                            {isBrowsing && (
                                <motion.div
                                    key="locate-popup-button"
                                    initial={{
                                        opacity: 0,
                                        y: 52,
                                        scale: 0,
                                    }}
                                    animate={{
                                        opacity: 1,
                                        y: 0,
                                        scale: 1,
                                        transition: {
                                            type: 'spring',
                                            stiffness: 380,
                                            damping: 22,
                                            mass: 0.6,
                                        },
                                    }}
                                    exit={{
                                        y: 52,
                                        scale: 0,
                                        opacity: [1, 1, 0], // 前 85% 保持完全实体，最后 15% 缩入主按钮后轻柔淡出
                                        transition: {
                                            y: {
                                                duration: 0.28,
                                                ease: [0.36, 0, 0.66, -0.1],
                                            },
                                            scale: {
                                                duration: 0.28,
                                                ease: [0.36, 0, 0.66, -0.1],
                                            },
                                            opacity: {
                                                duration: 0.28,
                                                times: [0, 0.85, 1],
                                                ease: 'easeOut',
                                            },
                                        },
                                    }}
                                    className="absolute bottom-13 z-10 pointer-events-auto"
                                >
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    onUserFinishScrolling();
                                                }}
                                                className={cn(
                                                    'w-9 h-9 rounded-full flex items-center justify-center cursor-pointer select-none',
                                                    'bg-stone-900/90 text-amber-400 border border-white/20 backdrop-blur-xl shadow-md',
                                                    'dark:bg-neutral-900/90 dark:text-amber-400 dark:border-white/15',
                                                    'hover:scale-110 active:scale-95 transition-[transform,background-color] duration-150'
                                                )}
                                                aria-label="回到当前播放位置"
                                            >
                                                <LocateFixed className="w-4 h-4 animate-pulse" />
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="left" className="text-xs">
                                            回到当前播放位置
                                        </TooltipContent>
                                    </Tooltip>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* 1. 打开/收起控制面板主按钮（位于 z-20，遮挡在定位按钮前上方） */}
                        <motion.div
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
                            transition={{
                                delay: 0.15,
                                duration: 0.2,
                            }}
                            className="absolute bottom-0 z-20 pointer-events-auto"
                        >
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            await swrApiMutate('watch-history/list');
                                            pauseMeasurement();
                                            changeSideBar(!showSideBar);
                                        }}
                                        className={cn(
                                            'w-11 h-11 rounded-full flex items-center justify-center cursor-pointer select-none group',
                                            'bg-stone-900/90 text-stone-100 border border-white/20 backdrop-blur-xl shadow-lg',
                                            'dark:bg-neutral-100/90 dark:text-neutral-900 dark:border-black/10',
                                            'opacity-80 hover:opacity-100 hover:scale-105 active:scale-95 transition-[transform,opacity,background-color] duration-150'
                                        )}
                                        aria-label="打开控制面板"
                                    >
                                        <LayoutGrid className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="text-xs">
                                    {showSideBar ? '收起控制面板' : '打开控制面板'}
                                    {openControlPanelShortcut ? ` (${openControlPanelShortcut})` : ''}
                                </TooltipContent>
                            </Tooltip>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </TooltipProvider>
    );
}
