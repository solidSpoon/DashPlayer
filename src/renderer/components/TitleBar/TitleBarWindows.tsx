import React from 'react';
import useSystem from '../../hooks/useSystem';
import { cn } from '../../../common/utils/Util';
import './TitleBarWindows.css';

export interface TitleBarWindowsProps {
    maximizable?: boolean;
    className?: string;
}

const api = window.electron;
const TitleBarWindows = ({ maximizable, className }: TitleBarWindowsProps) => {
    const [hover, setHover] = React.useState(false);
    const windowState = useSystem((s) => s.windowState);
    const setWindowState = useSystem((s) => s.setWindowState);

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

    const onMenu = async () => {
        await api.openMenu();
    };

    return (
        <div
            className={`absolute top-0 z-50 select-none w-full drag h-9 flex justify-end items-center text-titlebarText gap-x-2  ${className}`}
        >
            <div className="no-drag flex justify-center gap-1 items-center py-2 px-2 traffic-lights">
                <button
                    onClick={onClose}
                    className="traffic-light traffic-light-close"
                    id="close"
                />
                <button
                    onClick={onMinimize}
                    className="traffic-light traffic-light-minimize"
                    id="minimize"
                />
                <button
                    onClick={() => {
                        if (
                            (maximizable ?? true) &&
                            windowState === 'maximized'
                        ) {
                            unMaximize();
                        } else {
                            maximize();
                        }
                    }}
                    className="traffic-light traffic-light-maximize"
                    id="maximize"
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
