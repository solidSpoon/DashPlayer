import React from 'react';
import { twMerge } from 'tailwind-merge';
import OpenFile from './OpenFile';
import WatchProjectBrowser from './WatchProjectBrowser';

const FileBrowser = () => {
    return (
        <div
            onClick={(e) => {
                e.stopPropagation();
            }}
            className={twMerge(
                'flex-1 flex flex-col gap-2 items-center justify-center p-10 rounded-lg w-full h-full text-black',
                'bg-white drop-shadow-lg'
            )}
        >
            <OpenFile directory={false} />
            <OpenFile directory />
            <WatchProjectBrowser />
        </div>
    );
};

export default FileBrowser;
