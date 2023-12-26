import React from 'react';
import {
    HiOutlineMenu,
    HiOutlinePencil,
    HiOutlinePuzzle
} from 'react-icons/hi';
import {
    VscChromeClose,
    VscChromeMaximize,
    VscChromeMinimize,
    VscChromeRestore
} from 'react-icons/vsc';
import { useShallow } from 'zustand/react/shallow';
import useSystem from '../../hooks/useSystem';
import usePlayerController from '../../hooks/usePlayerController';
import { cn } from '../../../common/utils/Util';

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
                             buttonClassName
                         }: TitleBarWindowsProps) => {
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

    const Button = (icon: JSX.Element, onClick: () => void) => {
        if (hover) {
            return (<div className={cn('w-6 h-6 p-1 rounded-full')}>
                {React.cloneElement(icon, {
                    className: cn(
                        ...(icon.props.className??'').split(' '),
                        'w-full h-full p-0.5 rounded-full fill-neutral-400 fill-black border border-neutral-400/80 shadow-inner'
                    ),
                    onClick
                })}
            </div>);
        }
        return (<div className={cn('w-6 h-6 p-1 rounded-full')}>
            <div className={cn('w-full h-full rounded-full bg-neutral-400/30 border border-neutral-400/50')} />
        </div>);
    };

    return (
        <div
            className={`absolute top-0 z-50 select-none w-full drag h-7 flex justify-end items-start text-titlebarText gap-x-2  ${className}`}
        >
            <div
                onMouseOver={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
                className='no-drag flex justify-center items-center py-2 px-2'>
                {Button(<VscChromeMinimize className={cn('bg-yellow-500')}/>, onMinimize)}
                {Button(
                    maximizable && windowState === 'maximized' ? (
                        <VscChromeRestore className={cn('bg-green-500')}/>
                    ) : (
                        <VscChromeMaximize className={cn('bg-green-500')}/>
                    ),
                    maximizable && windowState === 'maximized'
                        ? unMaximize
                        : maximize
                )}
                {Button(<VscChromeClose className={cn('bg-red-500')}/>, onClose)}
            </div>
        </div>
    );
};

TitleBarWindows.defaultProps = {
    maximizable: true,
    title: '',
    className: '',
    buttonClassName: ''
};
export default TitleBarWindows;
