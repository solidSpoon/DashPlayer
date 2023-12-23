import React, { useEffect, useState } from 'react';
import useSystem from '../../hooks/useSystem';
import useLayout from '../../hooks/useLayout';
import { cn } from '../../../common/utils/Util';

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
    const showSideBar = useLayout((s) => s.showSideBar);
    const showTitleBar = (!autoHide || isMouseOver) && false;
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

    // useEffect(() => {
    //     const init = async () => {
    //         if (isMain) {
    //             if (autoHide) {
    //                 await api.hideButton();
    //             } else {
    //                 await api.showButton();
    //             }
    //         }
    //     };
    //     init();
    // }, [autoHide, isMain]);

    return (
        // eslint-disable-next-line jsx-a11y/mouse-events-have-key-events
        <div onMouseOver={handleMouseOver} onMouseLeave={handleMouseLeave}>
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
            <div
                className={cn(
                    'drag w-full h-10 absolute top-0 z-50 content-center text-titlebarText flex flex-col justify-center items-center select-none',
                    showTitleBar && className,
                    hasSubtitle && !showSideBar && '-translate-x-2'
                )}
                onDoubleClick={() => {
                    onDoubleClick();
                }}
            >
                {showTitleBar ? title : ''}
            </div>
        </div>
    );
};
TitleBarMac.defaultProps = {
    autoHide: true,
    className: '',
    hasSubtitle: false,
};
export default TitleBarMac;
