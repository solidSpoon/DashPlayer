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
        if (showSideBar) {
            await api.showButton();
            return;
        }
        if (!fullScreen && autoHide) {
            if (isMain) {
                await api.showButton();
            }
        }
    };

    const handleMouseLeave = async () => {
        const fullScreen = windowState === 'fullscreen';
        setIsMouseOver(false);
        if (showSideBar) {
            await api.showButton();
            return;
        }
        if (!fullScreen && autoHide) {
            setIsMouseOver(false);
            if (isMain) {
                await api.hideButton();
            }
        }
        console.log('handleMouseLeave');
    };

    useEffect(() => {
        const runEffect = async () => {
            if (showSideBar) {
                await api.showButton();
                return;
            }
            if (isMouseOver) {
                await api.showButton();
            } else {
                await api.hideButton();
            }
        };
        runEffect();
    }, [isMouseOver, showSideBar]);

    return (
        // eslint-disable-next-line jsx-a11y/mouse-events-have-key-events
        <div onMouseOver={handleMouseOver} onMouseLeave={handleMouseLeave}>
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
            <div
                className={cn(
                    'drag w-full h-10 absolute top-0 z-50',
                    showTitleBar && className,
                    hasSubtitle && !showSideBar && '-translate-x-2'
                )}
                onDoubleClick={() => {
                    onDoubleClick();
                }}
            />
        </div>
    );
};
TitleBarMac.defaultProps = {
    autoHide: true,
    className: '',
    hasSubtitle: false,
};
export default TitleBarMac;
