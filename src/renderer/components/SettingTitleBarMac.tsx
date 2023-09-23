import { useState } from 'react';
import callApi from '../lib/apis/ApiWrapper';

export interface TitleBarProps {
    title: string | undefined;
    show: boolean;
}

const TitleBarMac = ({ title, show }: TitleBarProps) => {
    return (
        // eslint-disable-next-line jsx-a11y/mouse-events-have-key-events
        <div onMouseOver={handleMouseOver} onMouseLeave={handleMouseLeave}>
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
            <div
                className={`drag w-full h-10 absolute top-0 z-50 content-center text-black flex flex-col justify-center items-center select-none ${
                    showTitleBar
                        ? 'bg-stone-200 shadow-inner shadow-stone-100 drop-shadow'
                        : ''
                }`}
                onDoubleClick={() => {
                    onDoubleClick();
                }}
            >
                <span className="text-black">{showTitleBar ? title : ''}</span>
            </div>
        </div>
    );
};
export default TitleBarMac;
