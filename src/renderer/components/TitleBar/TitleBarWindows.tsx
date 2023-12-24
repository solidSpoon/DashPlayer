import React from 'react';
import { HiOutlineMenu, HiOutlinePencil, HiOutlinePuzzle } from 'react-icons/hi';
import {
    VscChromeClose,
    VscChromeMaximize,
    VscChromeMinimize,
    VscChromeRestore,
} from 'react-icons/vsc';
import { useShallow } from 'zustand/react/shallow';
import useSystem from '../../hooks/useSystem';
import usePlayerController from '../../hooks/usePlayerController';

export interface TitleBarWindowsProps {
    title?: string;
    maximizable?: boolean;
    className?: string;
    buttonClassName?: string;
}

const api = window.electron;
const TitleBarWindows = ({
    title,
    maximizable,
    className,
    buttonClassName,
}: TitleBarWindowsProps) => {
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
            className={`select-none w-full drag h-7 flex justify-between items-center text-titlebarText gap-x-2  ${className}`}
        >
            <div className={'h-7 w-20'}></div>
            <div>{title}</div>
            <div className="no-drag flex h-full justify-center items-center">
                <VscChromeMinimize
                    className={` w-7 h-7 p-1.5 ${buttonClassName}`}
                    onClick={onMinimize}
                />
                {maximizable && windowState === 'maximized' && (
                    <VscChromeRestore
                        className={` w-7 h-7 p-1.5 ${buttonClassName}`}
                        onClick={unMaximize}
                    />
                )}
                {maximizable && !(windowState === 'maximized') && (
                    <VscChromeMaximize
                        className={` w-7 h-7 p-1.5 ${buttonClassName}`}
                        onClick={maximize}
                    />
                )}

                <VscChromeClose
                    className={` w-7 h-7 p-1.5 ${buttonClassName}`}
                    onClick={onClose}
                />
            </div>
        </div>
    );
};

TitleBarWindows.defaultProps = {
    maximizable: true,
    title: '',
    className: '',
    buttonClassName: '',
};
export default TitleBarWindows;
