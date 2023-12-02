import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import useSystem from '../../hooks/useSystem';
import { cn } from '../../../utils/Util';

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
        <div className={cn('fixed h-10 drag w-full top-0 left-0 z-50')}>
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
            <AnimatePresence>
                {showTitleBar && (
                    <>
                        <motion.div
                            initial={{ y: -100 }}
                            animate={{ y: 0 }}
                            exit={{ y: -100 }}
                            transition={{
                                duration: 0.2,
                                ease: 'easeInOut',
                            }}
                            className={cn(
                                `drag w-full h-full content-center text-titlebarText grid place-content-center items-center select-none`,
                                showTitleBar && className,
                                hasSubtitle && '-translate-x-2'
                            )}
                            onDoubleClick={() => {
                                onDoubleClick();
                            }}
                        >
                            {title}
                        </motion.div>
                        {hasSubtitle && (
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 1 1"
                                className={cn(
                                    `absolute top-0 right-0 w-1 h-1 fill-scrollbarTrack -translate-x-2 rotate-180`,
                                    'translate-y-10'
                                )}
                            >
                                <path d="M 0 0 L 0 1 L 1 1 C 0 1 0 0 0 0 Z" />
                            </svg>
                        )}
                    </>
                )}
            </AnimatePresence>
            <div
                onMouseOver={handleMouseOver}
                onMouseLeave={handleMouseLeave}
                className={cn('w-full h-10 absolute top-0')}
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
