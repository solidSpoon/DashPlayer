import React, { useEffect, useState } from 'react';
import useSystem from '../../hooks/useSystem';

export interface TitleBarProps {
    hasSubtitle?: boolean;
    title: string | undefined;
    autoHide?: boolean;
    className?: string;
}

const api = window.electron;

const TitleBarMac = ({
    hasSubtitle,
    title,
    autoHide,
    className,
}: TitleBarProps) => {
    const [isMouseOver, setIsMouseOver] = useState(false);
    const showTitleBar = !autoHide || isMouseOver;
    const windowState = useSystem((s) => s.windowState);
    const setWindowState = useSystem((s) => s.setWindowState);
    const isMain = useSystem((s) => s.isMain);
    const onDoubleClick = async () => {
        if (windowState === 'maximized') {
            setWindowState('normal');
        } else {
            setWindowState('maximized');
        }
    };

    const handleMouseOver = async () => {
        const fullScreen = windowState === 'fullscreen';
        setIsMouseOver(!fullScreen);
        if (!fullScreen && autoHide) {
            if (isMain) {
                await api.showButton();
            }
        }
        console.log('handleMouseOver');
    };

    const handleMouseLeave = async () => {
        const fullScreen = windowState === 'fullscreen';
        setIsMouseOver(false);
        if (!fullScreen && autoHide) {
            setIsMouseOver(false);
            if (isMain) {
                await api.hideButton();
            }
        }
        console.log('handleMouseLeave');
    };

    useEffect(() => {
        const init = async () => {
            if (isMain) {
                if (autoHide) {
                    await api.hideButton();
                } else {
                    await api.showButton();
                }
            }
        };
        init();
    }, [autoHide, isMain]);

    return (
        // eslint-disable-next-line jsx-a11y/mouse-events-have-key-events
        <div onMouseOver={handleMouseOver} onMouseLeave={handleMouseLeave}>
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
            <div
                className={`drag w-full h-10 absolute top-0 z-50 content-center text-titlebarText flex flex-col justify-center items-center select-none ${
                    showTitleBar ? className : ''
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
TitleBarMac.defaultProps = {
    autoHide: true,
    className: '',
    hasSubtitle: false,
};
export default TitleBarMac;
