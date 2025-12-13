import React from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {cn} from "@/fronted/lib/utils";
import useLayout from '../../hooks/useLayout';
import { useSubtitleScrollState } from '../../hooks/useSubtitleScroll';
import { swrApiMutate } from '@/fronted/lib/swr-util';
import {useHotkeys} from "react-hotkeys-hook";
import {Button} from "@/fronted/components/ui/button";
import useSetting from '@/fronted/hooks/useSetting';

const process = (values: string) => values
    .split(',')
    .map((k) => k.replaceAll(' ', ''))
    .filter((k) => k !== '')
    // remove left right up down space
    .filter((k) => k !== 'left' && k !== 'right' && k !== 'up' && k !== 'down' && k !== 'space')

export default function ControlButton() {
    const changeSideBar = useLayout((s) => s.changeSideBar);
    const showSideBar = useLayout((s) => s.showSideBar);
    const pauseMeasurement = useSubtitleScrollState((state) => state.pauseMeasurement);
    const fullScreen = useLayout(s => s.fullScreen);
    const setting = useSetting((s) => s.setting);

    useHotkeys(process(setting('shortcut.openControlPanel')), () => {
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
                        await swrApiMutate('watch-history/list');
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
                             stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                             className="lucide lucide-command text-white">
                            <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"/>
                        </svg>
                    </Button>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
