import React, { useEffect } from 'react';
import {
    AiOutlineClose,
    AiOutlineCompress,
    AiOutlineMinus,
} from 'react-icons/ai';
import { FiMaximize } from 'react-icons/fi';
import { HiOutlineMenu } from 'react-icons/hi';

export interface TitleBarWindowsProps {
    title: string | undefined;
}

const api = window.electron;

const TitleBarWindows = ({ title }: TitleBarWindowsProps) => {
    const [isMaximized, setIsMaximized] = React.useState(false);

    useEffect(() => {
        const init = async () => {
            const isM = await api.isMaximized();
            setIsMaximized(isM);
        };
        init();
        const removeMaximize = api.onMaximize(() => setIsMaximized(true));
        const removeUnMaximize = api.onUnMaximize(() => setIsMaximized(false));

        return () => {
            removeMaximize();
            removeUnMaximize();
        };
    }, [isMaximized]);

    const maximize = async () => {
        await api.maximize();
    };

    const unMaximize = async () => {
        await api.unMaximize();
    };

    const onMinimize = async () => {
        await api.minimize();
    };

    const onClose = async () => {
        await api.close();
    };

    const onMenu = async () => {
        await api.openMenu();
    };

    return (
        <div className="select-none w-full drag h-7 flex justify-between items-center bg-neutral-800 text-neutral-200 space-x-2 drop-shadow">
            <HiOutlineMenu
                className="no-drag hover:bg-neutral-500 w-7 h-7 p-1"
                onClick={onMenu}
            />
            <div>{title}</div>
            <div className="no-drag flex space-x-2 h-full justify-center items-center">
                <AiOutlineMinus
                    className="hover:bg-neutral-500 w-7 h-7 p-1"
                    onClick={onMinimize}
                />
                {isMaximized ? (
                    <AiOutlineCompress
                        className="hover:bg-neutral-500 w-7 h-7 p-1"
                        onClick={unMaximize}
                    />
                ) : (
                    <FiMaximize
                        className="hover:bg-neutral-500 w-7 h-7 p-1"
                        onClick={maximize}
                    />
                )}
                <AiOutlineClose
                    className="hover:bg-neutral-500 w-7 h-7 p-1"
                    onClick={onClose}
                />
            </div>
        </div>
    );
};
export default TitleBarWindows;
