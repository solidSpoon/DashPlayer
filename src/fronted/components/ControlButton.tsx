import React from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {cn} from "@/fronted/lib/utils";
import useLayout from '../hooks/useLayout';
import useSubtitleScroll from '../hooks/useSubtitleScroll';
import {SWR_KEY, swrMutate} from '@/fronted/lib/swr-util';
import {useHotkeys} from "react-hotkeys-hook";
import {Button} from "@/fronted/components/ui/button";

export default function ControlButton() {
    const changeSideBar = useLayout((s) => s.changeSideBar);
    const showSideBar = useLayout((s) => s.showSideBar);
    const pauseMeasurement = useSubtitleScroll(state => state.pauseMeasurement);
    const fullScreen = useLayout(s => s.fullScreen);
    useHotkeys('ctrl', () => {
        changeSideBar(!showSideBar);
    });
    return (
        <AnimatePresence>
            {!fullScreen && (
                <motion.div
                    className={cn(
                        ' fixed bottom-12 right-12 z-[99]',
                    )}
                    onClick={async () => {
                        await swrMutate(SWR_KEY.WATCH_PROJECT_LIST)
                        pauseMeasurement();
                        changeSideBar(!showSideBar);
                    }}
                    transition={{
                        delay: 0.2,
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
                            className={cn('bg-lime-600 hover:bg-lime-700',
                                'dark:bg-lime-700 dark:hover:bg-lime-800',
                                'transition-colors duration-200 drop-shadow-md rounded-full',
                                'backdrop-blur-3xl w-12 h-12'
                            )}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                             className="lucide lucide-command text-white">
                            <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"/>
                        </svg>
                    </Button>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
