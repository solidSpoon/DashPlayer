import React, {useEffect, useState} from 'react';
import {cn} from "@/fronted/lib/utils";
import './TitleBarWindows.css';
import useLayout from "@/fronted/hooks/useLayout";
import {SWR_KEY, swrMutate} from "@/fronted/lib/swr-util";

export interface TitleBarWindowsProps {
    maximizable?: boolean;
    className?: string;
}

const api = window.electron;
const TitleBarWindows = ({maximizable, className}: TitleBarWindowsProps) => {
    const showSideBar = useLayout((s) => s.showSideBar);
    const [showTrafficLight, setShowTrafficLight] = useState(false);
    const [hover, setHover] = useState(false);
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
        <div
            className={`absolute top-0 z-50 select-none w-full drag h-9 flex justify-end items-start text-titlebarText gap-x-2  ${className}`}
        >
            <div
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
                className={cn("no-drag flex justify-center gap-1 items-center py-2 px-2 traffic-lights", !showTrafficLight && !hover && 'opacity-0')}>
                <button
                    onClick={async () => {
                        await api.call('system/window-size/change', 'minimized')
                        await swrMutate(SWR_KEY.WINDOW_SIZE);
                    }}
                    className="traffic-light traffic-light-minimize"
                    id="minimize"
                />
                <button
                    onClick={async () => {
                        if (maximizable ?? true) {
                            const windowState = await api.call('system/window-size');
                            if (windowState === 'maximized' || windowState === 'fullscreen') {
                                await api.call('system/window-size/change', 'normal')
                            } else {
                                await api.call('system/window-size/change', 'maximized')
                            }
                            await swrMutate(SWR_KEY.WINDOW_SIZE);
                        }
                    }}
                    onContextMenu={async (e) => {
                        e.preventDefault();
                        const windowState = await api.call('system/window-size');
                        if (windowState === 'fullscreen') {
                            // await api.call('')
                            await api.call('system/window-size/change', 'normal')
                        } else {
                            // onFullScreen();
                            await api.call('system/window-size/change', 'fullscreen')
                        }
                        await swrMutate(SWR_KEY.WINDOW_SIZE);
                    }}
                    className="traffic-light traffic-light-maximize"
                    id="maximize"
                />
                <button
                    onClick={async () => {
                        await api.call('system/window-size/change', 'closed')
                        await swrMutate(SWR_KEY.WINDOW_SIZE);
                    }}
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
