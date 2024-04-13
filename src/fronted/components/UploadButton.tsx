import React from 'react';
import { IoIosSwitch } from 'react-icons/io';
import {AnimatePresence, motion} from 'framer-motion';
import { FaMaximize } from 'react-icons/fa6';
import { cn } from '@/common/utils/Util';
import useLayout from '../hooks/useLayout';
import useSubtitleScroll from '../hooks/useSubtitleScroll';
import { SWR_KEY, swrMutate } from '@/fronted/lib/swr-util';

export default function UploadButton() {
    const changeSideBar = useLayout((s) => s.changeSideBar);
    const showSideBar = useLayout((s) => s.showSideBar);
    const pauseMeasurement = useSubtitleScroll(state => state.pauseMeasurement);
    const fullScreen = useLayout(s => s.fullScreen);
    return (
        <AnimatePresence>
            {!fullScreen && (
              <motion.div
                className={cn(
                    'flex items-center justify-center hover:bg-uploadButton/90 w-12 h-12 drop-shadow-md fixed bottom-12 right-12 z-[99] p-3.5 backdrop-blur-3xl overflow-hidden',
                    'bg-lime-600 hover:bg-lime-700',
                    'dark:bg-lime-700 dark:hover:bg-lime-800',
                    'transition-colors duration-200'
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
                    borderRadius: showSideBar ? '10%' : '50%',
                    scale: 1,
                }}
                exit={{
                    scale: 0,
                }}
            >
                {showSideBar ? (
                    <FaMaximize className={cn('w-full h-full fill-white ')} />
                ) : (
                    <IoIosSwitch className={cn('w-full h-full fill-white ')} />
                )}
            </motion.div>
            )}
        </AnimatePresence>
    );
}
