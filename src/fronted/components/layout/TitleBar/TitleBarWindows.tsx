import React from 'react';
import { cn } from '@/fronted/lib/utils';
import './TitleBarWindows.css';
import useLayout from '@/fronted/hooks/useLayout';
import { SWR_KEY, swrMutate } from '@/fronted/lib/swr-util';
import useTrafficLightsVisibility from './useTrafficLightsVisibility';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';

export interface TitleBarWindowsProps {
    maximizable?: boolean;
    className?: string;
}

const api = backendClient;
const TitleBarWindows = ({ maximizable, className }: TitleBarWindowsProps) => {
    const showSideBar = useLayout((s) => s.showSideBar);
    const { visible, onMouseEnter, onMouseLeave, onMouseMove } = useTrafficLightsVisibility(showSideBar);

    const canMaximize = maximizable ?? true;
    const trafficLightsVisible = visible;

    return (
        <div
            className={`absolute top-0 z-50 select-none w-full drag h-9 flex justify-end items-start text-titlebarText gap-x-2  ${className}`}
        >
            <div
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                onMouseMove={onMouseMove}
                className="no-drag py-2 px-2"
            >
                <div
                    className={cn(
                        'flex justify-center gap-1 items-center traffic-lights transition-opacity duration-200',
                        !trafficLightsVisible && 'opacity-0 pointer-events-none',
                    )}
                >
                    <button
                        onClick={async () => {
                            await api.call('system/window-size/change', 'minimized');
                            await swrMutate(SWR_KEY.WINDOW_SIZE);
                        }}
                        className="traffic-light traffic-light-minimize"
                        id="minimize"
                        type="button"
                        aria-label="Minimize window"
                        title="Minimize"
                    />
                    <button
                        onClick={async () => {
                            if (!canMaximize) {
                                return;
                            }
                            const windowState = await api.call('system/window-size');
                            if (windowState === 'maximized' || windowState === 'fullscreen') {
                                await api.call('system/window-size/change', 'normal');
                            } else {
                                await api.call('system/window-size/change', 'maximized');
                            }
                            await swrMutate(SWR_KEY.WINDOW_SIZE);
                        }}
                        onContextMenu={async (e) => {
                            if (!canMaximize) {
                                return;
                            }
                            e.preventDefault();
                            const windowState = await api.call('system/window-size');
                            if (windowState === 'fullscreen') {
                                // await api.call('')
                                await api.call('system/window-size/change', 'normal');
                            } else {
                                // onFullScreen();
                                await api.call('system/window-size/change', 'fullscreen');
                            }
                            await swrMutate(SWR_KEY.WINDOW_SIZE);
                        }}
                        className={cn('traffic-light traffic-light-maximize', !canMaximize && 'opacity-50 cursor-not-allowed')}
                        id="maximize"
                        type="button"
                        disabled={!canMaximize}
                        aria-label="Maximize window"
                        title={canMaximize ? 'Maximize' : 'Maximize disabled'}
                    />
                    <button
                        onClick={async () => {
                            await api.call('system/window-size/change', 'closed');
                            await swrMutate(SWR_KEY.WINDOW_SIZE);
                        }}
                        className="traffic-light traffic-light-close"
                        id="close"
                        type="button"
                        aria-label="Close window"
                        title="Close"
                    />
                </div>
            </div>
        </div>
    );
};

TitleBarWindows.defaultProps = {
    maximizable: true,
    className: '',
};
export default TitleBarWindows;
