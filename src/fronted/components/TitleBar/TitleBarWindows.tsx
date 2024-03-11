import React, {useEffect, useState} from 'react';
import useSystem from '../../hooks/useSystem';
import { cn } from '../../../common/utils/Util';
import './TitleBarWindows.css';
import useLayout from "@/fronted/hooks/useLayout";

export interface TitleBarWindowsProps {
    maximizable?: boolean;
    className?: string;
}

const TitleBarWindows = ({ maximizable, className }: TitleBarWindowsProps) => {
    const showSideBar = useLayout((s) => s.showSideBar);
    const windowState = useSystem((s) => s.windowState);
    const setWindowState = useSystem((s) => s.setWindowState);
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
    const maximize = () => {
        setWindowState('maximized');
    };

    const unMaximize = () => {
        setWindowState('normal');
    };

    const onMinimize = async () => {
        setWindowState('minimized');
    };

    const onClose = async () => {
        setWindowState('closed');
    };

    return (
        <div
            className={`absolute top-0 z-50 select-none w-full drag h-9 flex justify-end items-center text-titlebarText gap-x-2  ${className}`}
        >
            <div className={cn("no-drag flex justify-center gap-1 items-center py-2 px-2 traffic-lights", !showTrafficLight && 'opacity-0')}>
                <button
                    onClick={onMinimize}
                    className="traffic-light traffic-light-minimize"
                    id="minimize"
                />
                <button
                    onClick={() => {
                        if (maximizable ?? true) {
                            if (windowState === 'maximized') {
                                unMaximize();
                            } else {
                                maximize();
                            }
                        }
                    }}
                    className="traffic-light traffic-light-maximize"
                    id="maximize"
                />
                <button
                  onClick={onClose}
                  className="traffic-light traffic-light-close"
                  id="close"
                />
            </div>
        </div>
    );
};

TitleBarWindows.defaultProps = {
    maximizable: true,
    className: '',
};
export default TitleBarWindows;
