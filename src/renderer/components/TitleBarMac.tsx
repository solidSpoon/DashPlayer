import { useEffect, useState } from 'react';
import callApi from '../lib/apis/ApiWrapper';
import TransFiller from '../lib/TransFiller';

export interface TitleBarProps {
    title: string | undefined;
    show: boolean;
}

const TitleBarMac = ({ title, show }: TitleBarProps) => {
    const [isMouseOver, setIsMouseOver] = useState(false);
    const showTitleBar = show || isMouseOver;
    const onDoubleClick = async () => {
        const isMaximized = (await callApi('is-maximized', [])) as boolean;
        if (isMaximized) {
            await callApi('unmaximize', []);
        } else {
            await callApi('maximize', []);
        }
    };

    const handleMouseOver = async () => {
        const fullScreen = (await callApi('is-full-screen', [])) as boolean;
        console.log('fullScreen', fullScreen);
        if (fullScreen) {
            setIsMouseOver(false);
        } else {
            setIsMouseOver(true);
            await callApi('show-button', []);
        }
    };

    const handleMouseLeave = async () => {
        const fullScreen = (await callApi('is-full-screen', [])) as boolean;
        console.log('fullScreen', fullScreen);
        if (fullScreen) {
            setIsMouseOver(false);
        } else {
            setIsMouseOver(false);
            await callApi('hide-button', []);
        }
    };

    return (
        // eslint-disable-next-line jsx-a11y/mouse-events-have-key-events
        <div onMouseOver={handleMouseOver} onMouseLeave={handleMouseLeave}>
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
            <div
                className={`drag w-full h-10 absolute top-0 z-50 content-center flex flex-col justify-center items-center select-none ${
                    showTitleBar ? 'bg-amber-300' : ''
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
