import React from 'react';
import { MdVideoSettings } from 'react-icons/md';
import usePlayerController from '../hooks/usePlayerController';
import { cn } from '../../utils/Util';
import useLayout from '../hooks/useLayout';

export default function UploadButton() {
    const changeSideBar = useLayout((s) => s.changeSideBar);
    const showSideBar = useLayout((s) => s.showSideBar);
    return (
        <>
            {/* eslint-disable-next-line jsx-a11y/anchor-is-valid,jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions */}
            <div
                className="flex items-center justify-center bg-uploadButton/80 hover:bg-uploadButton/90 rounded-full w-12 h-12 drop-shadow-md fixed bottom-12 right-12 z-[99] backdrop-blur-3xl p-3.5"
                onClick={() => {
                    changeSideBar(!showSideBar);
                }}
            >
                <MdVideoSettings className={cn('w-full h-full')} />
            </div>
        </>
    );
}
