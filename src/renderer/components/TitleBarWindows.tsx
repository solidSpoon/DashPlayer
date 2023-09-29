import React, { useEffect } from 'react';
import {
    AiOutlineClose,
    AiOutlineCompress,
    AiOutlineMinus
} from 'react-icons/ai';
import { FiMaximize } from 'react-icons/fi';
import { HiOutlineMenu } from 'react-icons/hi';

export interface TitleBarWindowsProps {
    hasSubtitle: boolean;
    title: string | undefined;
}

const api = window.electron;

const TitleBarWindows = ({ title, hasSubtitle }: TitleBarWindowsProps) => {
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
        <div
            className='select-none w-full drag h-6 flex justify-between items-center bg-stone-200 text-neutral-900 gap-x-2 drop-shadow'>
            <HiOutlineMenu
                className='no-drag hover:bg-neutral-300 w-6 h-6 p-1'
                onClick={onMenu}
            />
            <div>{title}</div>
            <div className='no-drag flex h-full justify-center items-center'>
                <AiOutlineMinus
                    className='hover:bg-neutral-300 w-6 h-6 p-1'
                    onClick={onMinimize}
                />
                {isMaximized ? (
                    <AiOutlineCompress
                        className='hover:bg-neutral-300 w-6 h-6 p-[5px]'
                        onClick={unMaximize}
                    />
                ) : (
                    <FiMaximize
                        className='hover:bg-neutral-300 w-6 h-6 p-[5px]'
                        onClick={maximize}
                    />
                )}
                <AiOutlineClose
                    className={`hover:bg-neutral-300 w-6 h-6 p-1
                    ${false ?  'p-1 border border-stone-200 rounded-b-lg z-20':''}`}
                    onClick={onClose}
                />
            </div>
            {hasSubtitle && (
                <>

                    <div
                        className={`absolute top-0 right-0 w-1 h-1 bg-stone-200 -translate-x-2 translate-y-6`}
                    >
                        <div className='w-full h-full rounded-tr-full bg-neutral-800' />
                    </div>
                    {/*<div*/}
                    {/*    className={`absolute top-0 right-0 w-2 h-2 bg-stone-200 translate-y-5 z-10`}*/}
                    {/*>*/}
                    {/*    <div className='w-full h-full rounded-br-full bg-neutral-800' />*/}
                    {/*</div>*/}
                </>)
            }
        </div>
    )
        ;
};
export default TitleBarWindows;
