import React, { useEffect, useState } from 'react';
import useLayout from '../../hooks/useLayout';
import { cn } from '@/common/utils/Util';
import './TitleBarWindows.css'



const TitleBarMac = () => {
    const showSideBar = useLayout((s) => s.showSideBar);

    const [showTrafficLight, setShowTrafficLight] = useState(false);
    useEffect(() => {
        let timeout: NodeJS.Timeout;
        const handleMouseMove = () => {
            if (showSideBar) {
                if (timeout) {
                    clearTimeout(timeout);
                }
                setShowTrafficLight(true);
                return;
            }
            if (timeout) {
                clearTimeout(timeout);
            }
            setShowTrafficLight(true);
            timeout = setTimeout(() => {
                setShowTrafficLight(false);
            }, 1000);
        }
        handleMouseMove();
        window.addEventListener('mousemove', handleMouseMove);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
        }
    }, [showSideBar]);

    return (
        // eslint-disable-next-line jsx-a11y/mouse-events-have-key-events
        <div className={cn('w-full h-10 absolute top-0 z-50 flex')}
            >
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
            <div className={cn('w-20 h-full')}>
                <div
                    className={cn("no-drag flex justify-center gap-[8px] items-center translate-y-2 -translate-x-[6px]",
                        showTrafficLight ? 'opacity-100' : 'opacity-0',
                        )}>
                    <div
                        className="rounded-full w-3 h-3 bg-gray-400"
                    />
                    <div
                        className="rounded-full w-3 h-3 bg-gray-400"
                    />
                    <div
                        className="rounded-full w-3 h-3 bg-gray-400"
                    />
                </div>
            </div>
            <div
                className={cn('drag flex-1 h-full')}
                onDoubleClick={() => {
                    // onDoubleClick();
                }}
            />
        </div>
    );
};
TitleBarMac.defaultProps = {
};
export default TitleBarMac;
