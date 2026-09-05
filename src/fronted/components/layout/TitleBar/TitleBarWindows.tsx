import React from 'react';
import { cn } from '@/fronted/lib/utils';
import './TitleBarWindows.css';
import useLayout from '@/fronted/hooks/useLayout';
import { SWR_KEY, swrMutate } from '@/fronted/lib/swr-util';
import useTrafficLightsVisibility from './useTrafficLightsVisibility';
import { backendClient } from '@/fronted/infrastructure/electron/backendClient';
import { useTranslation } from 'react-i18next';

export interface TitleBarWindowsProps {
    maximizable?: boolean;
    className?: string;
}

const api = backendClient;
const TitleBarWindows = ({ maximizable, className }: TitleBarWindowsProps) => {
    const { t } = useTranslation('common');
    const showSideBar = useLayout((s) => s.showSideBar);
    const { visible, onMouseEnter, onMouseLeave, onMouseMove } = useTrafficLightsVisibility(showSideBar);

    const canMaximize = maximizable ?? true;
    const trafficLightsVisible = visible;

    return (
        <div
            className={`absolute top-0 right-0 z-50 select-none drag flex items-center pr-4 pt-4 ${className}`}
        >
            <div
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                onMouseMove={onMouseMove}
                className="no-drag flex items-center justify-center cursor-default"
            >
                <div
                    className={cn(
                        'flex justify-center items-center px-2.5 py-1.5 rounded-full bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15 border border-black/5 dark:border-white/10 shadow-xs backdrop-blur-md traffic-lights transition-all duration-200',
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
                        aria-label={t('minimize')}
                        title={t('minimize')}
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
                        aria-label={t('maximize')}
                        title={t('maximize')}
                    />
                    <button
                        onClick={async () => {
                            await api.call('system/window-size/change', 'closed');
                            await swrMutate(SWR_KEY.WINDOW_SIZE);
                        }}
                        className="traffic-light traffic-light-close"
                        id="close"
                        type="button"
                        aria-label={t('close')}
                        title={t('close')}
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
