import React, { useState } from 'react';
import callApi from '../lib/apis/ApiWrapper';

export interface TitleBarProps {
    hasSubtitle: boolean;
    title: string | undefined;
    show: boolean;
}

const api = window.electron;

const TitleBarMac = ({ hasSubtitle, title, show }: TitleBarProps) => {
    const [isMouseOver, setIsMouseOver] = useState(false);
    const showTitleBar = show || isMouseOver;
    const onDoubleClick = async () => {
        const isMaximized = await api.isMaximized();
        if (isMaximized) {
            await api.unMaximize();
        } else {
            await api.maximize();
        }
    };

    const handleMouseOver = async () => {
        const fullScreen = await api.isFullScreen();
        setIsMouseOver(!fullScreen);
        if (!fullScreen) {
            await api.showButton();
        }
    };

    const handleMouseLeave = async () => {
        const fullScreen = await api.isFullScreen();
        setIsMouseOver(false);
        if (!fullScreen) {
            setIsMouseOver(false);
            await api.hideButton();
        }
    };

    return (
        // eslint-disable-next-line jsx-a11y/mouse-events-have-key-events
        <div onMouseOver={handleMouseOver} onMouseLeave={handleMouseLeave}>
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
            <div
                className={`drag w-full h-10 absolute top-0 z-50 content-center text-titlebarText flex flex-col justify-center items-center select-none ${
                    showTitleBar ? 'bg-titlebar' : ''
                } ${hasSubtitle ? '-translate-x-2' : ''}`}
                onDoubleClick={() => {
                    onDoubleClick();
                }}
            >
                {showTitleBar ? title : ''}
            </div>

            {hasSubtitle && (
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 1 1"
                    className={`absolute top-0 right-0 w-1 h-1 fill-scrollbarTrack -translate-x-2 rotate-180
                        ${showTitleBar ? 'translate-y-10' : ''}
                `}
                >
                    <path d="M 0 0 L 0 1 L 1 1 C 0 1 0 0 0 0 Z" />
                </svg>
            )}
        </div>
    );
};
export default TitleBarMac;
