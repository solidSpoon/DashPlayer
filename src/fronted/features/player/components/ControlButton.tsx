import React from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {cn} from "@/fronted/lib/utils";
import useLayout from '@/fronted/hooks/useLayout';
import { useSubtitleScrollState } from '@/fronted/features/player/hooks/useSubtitleScroll';
import { swrApiMutate } from '@/fronted/lib/swr-util';
import {useHotkeys} from "react-hotkeys-hook";
import {Button} from "@/fronted/components/ui/button";
import useSetting from '@/fronted/features/settings/settingsStore';

const process = (values: string) => values
    .split(',')
    .map((k) => k.replaceAll(' ', ''))
    .filter((k) => k !== '')
    // remove left right up down space
    .filter((k) => k !== 'left' && k !== 'right' && k !== 'up' && k !== 'down' && k !== 'space')

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
            {!fullScreen && !showSideBar && (
                <motion.div
                    className={cn(
                        ' fixed bottom-10 right-10 z-[99]',
                    )}
                    onClick={async () => {
                        await swrApiMutate('watch-history/list');
                        pauseMeasurement();
                        changeSideBar(true);
                    }}
                    transition={{
                        delay: 0.15,
                        duration: 0.2,
                    }}
                    initial={{
                        scale: 0,
                    }}
                    animate={{
                        scale: 1,
                    }}
                    exit={{
                        scale: 0,
                    }}
                >
                    <Button size={'icon'}
                            className={cn('bg-primary text-primary-foreground hover:bg-primary/90',
                                'transition-all duration-200 shadow-xl rounded-full',
                                'w-11 h-11'
                            )}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
                             stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                             className="lucide lucide-command">
                            <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"/>
                        </svg>
                    </Button>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
