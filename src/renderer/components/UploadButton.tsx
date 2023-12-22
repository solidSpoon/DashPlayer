import React from 'react';
import { MdVideoSettings } from 'react-icons/md';
import { IoIosSwitch } from 'react-icons/io';
import { motion } from 'framer-motion';
import { TbArrowsMaximize } from 'react-icons/tb';
import usePlayerController from '../hooks/usePlayerController';
import { cn } from '../../common/utils/Util';
import useLayout from '../hooks/useLayout';
import { CgMaximizeAlt } from "react-icons/cg";
import { FaMaximize } from "react-icons/fa6";

export default function UploadButton() {
    const changeSideBar = useLayout((s) => s.changeSideBar);
    const showSideBar = useLayout((s) => s.showSideBar);
    return (
        <>
            {/* eslint-disable-next-line jsx-a11y/anchor-is-valid,jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions */}
            <motion.div
                className="flex items-center justify-center bg-uploadButton/80 hover:bg-uploadButton/90 w-12 h-12 drop-shadow-md fixed bottom-12 right-12 z-[99] p-3.5 backdrop-blur-3xl overflow-hidden"
                onClick={() => {
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
                    <FaMaximize
                        className={cn(
                            'w-full h-full fill-white dark:fill-black'
                        )}
                    />
                ) : (
                    <IoIosSwitch
                        className={cn(
                            'w-full h-full fill-white dark:fill-black'
                        )}
                    />
                )}
            </motion.div>
        </>
    );
}
