import React from 'react';
import usePlayerController from '../hooks/usePlayerController';
import { MdVideoSettings } from 'react-icons/md';
import { cn } from '../../utils/Util';

export default function UploadButton() {
    const changePopType = usePlayerController((s) => s.changePopType);
    const popType = usePlayerController((s) => s.popType);
    return (
        <>
            {/* eslint-disable-next-line jsx-a11y/anchor-is-valid,jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions */}
            <div
                className="flex items-center justify-center bg-uploadButton/80 hover:bg-uploadButton/90 rounded-full w-12 h-12 drop-shadow-md fixed bottom-12 right-12 z-[99] backdrop-blur-3xl p-3.5"
                onClick={() => {
                    changePopType(popType === 'control' ? 'none' : 'control');
                }}
            >
                <MdVideoSettings className={cn('w-full h-full')} />
            </div>
        </>
    );
}
