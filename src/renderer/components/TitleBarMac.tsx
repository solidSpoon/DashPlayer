import { useState } from 'react';
import callApi from '../lib/apis/ApiWrapper';

export interface TitleBarProps {
    title: string | undefined;
    show: boolean;
}

const api = window.electron;

const TitleBarMac = ({ title, show }: TitleBarProps) => {
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
