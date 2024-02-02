import React from 'react';
import { MdVideoSettings } from 'react-icons/md';
import { IoIosSwitch } from 'react-icons/io';
import { motion } from 'framer-motion';
import { TbArrowsMaximize } from 'react-icons/tb';
import { CgMaximizeAlt } from 'react-icons/cg';
import { FaMaximize } from 'react-icons/fa6';
import usePlayerController from '../hooks/usePlayerController';
import { cn } from '../../common/utils/Util';
import useLayout from '../hooks/useLayout';
import useSubtitleScroll from '../hooks/useSubtitleScroll';

export default function UploadButton() {
    const changeSideBar = useLayout((s) => s.changeSideBar);
    const showSideBar = useLayout((s) => s.showSideBar);
    const pauseMeasurement = useSubtitleScroll(state => state.pauseMeasurement);
    return (
        <>
            {/* eslint-disable-next-line jsx-a11y/anchor-is-valid,jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions */}
            <motion.div
                className={cn(
                    'flex items-center justify-center hover:bg-uploadButton/90 w-12 h-12 drop-shadow-md fixed bottom-12 right-12 z-[99] p-3.5 backdrop-blur-3xl overflow-hidden',
                    'bg-lime-600 hover:bg-lime-700',
                    'dark:bg-lime-700 dark:hover:bg-lime-800',
                    'transition-colors duration-200'
                )}
                onClick={() => {
                    pauseMeasurement();
                    changeSideBar(!showSideBar);
                }}
                transition={{
                    delay: 0.2,
                    duration: 0.2,
                }}
                // style={{
                //     borderRadius: showSideBar ? '10%' : '50%',
                // }}
                animate={{
                    borderRadius: showSideBar ? '10%' : '50%',
                }}
            >
                {showSideBar ? (
                    <FaMaximize className={cn('w-full h-full fill-white ')} />
                ) : (
                    <IoIosSwitch className={cn('w-full h-full fill-white ')} />
                )}
            </motion.div>
        </>
    );
}
