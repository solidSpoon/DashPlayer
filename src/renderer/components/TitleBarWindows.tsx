import React, { useEffect, useState } from 'react';
import { AiOutlineCloseSquare, AiOutlineMinus } from 'react-icons/ai';
import { GrClose, GrMenu } from 'react-icons/gr';
import { FaWindowMinimize } from 'react-icons/fa';
import { FiMaximize } from 'react-icons/fi';
import callApi from '../lib/apis/ApiWrapper';

export interface TitleBarWindowsProps {
    title: string | undefined;
}

const TitleBarWindows = ({ title }: TitleBarWindowsProps) => {
    const [isMouseOver, setIsMouseOver] = useState(false);

    const onMaximize = async () => {
        const isMaximized = (await callApi('is-maximized', [])) as boolean;
        if (isMaximized) {
            await callApi('unmaximize', []);
        } else {
            await callApi('maximize', []);
        }
    };

    const onMinimize = async () => {
        await callApi('minimize', []);
    };

    const onClose = async () => {
        await callApi('close', []);
    };

    const onMenu = async () => {
        await callApi('open-menu', []);
    };

    return (
        // eslint-disable-next-line jsx-a11y/mouse-events-have-key-events
        <div className="absolute top-0 z-50 select-none w-full">
            <div className="drag w-full h-5 min-h-3" />
            {/* eslint-disable-next-line jsx-a11y/mouse-events-have-key-events */}
            <div
                className="w-full h-10"
                onMouseOver={() => {
                    setIsMouseOver(true);
                }}
                onMouseLeave={() => setIsMouseOver(false)}
            >
                {isMouseOver ? (
                    <div
                        className={`h-10 flex w-fit px-2 items-center space-x-2 border-black border-4 hover:bg-white ${
                            isMouseOver ? 'bg-white' : ''
                        }`}
                    >
                        <GrClose
                            className="text-black hover:bg-amber-300 w-7 h-7"
                            onClick={onClose}
                        />
                        <FiMaximize
                            className="text-black hover:bg-amber-300 w-7 h-7"
                            onClick={onMaximize}
                        />
                        <AiOutlineMinus
                            className="text-black hover:bg-amber-300 w-7 h-7"
                            onClick={onMinimize}
                        />
                        <div className="h-7" />
                        <GrMenu
                            className="text-black hover:bg-amber-300 w-7 h-7 ml-3.5"
                            onClick={onMenu}
                        />

                        {title ? (
                            <>
                                <div className="h-7" />
                                <span className="text-black">{title}</span>
                            </>
                        ) : (
                            <></>
                        )}
                    </div>
                ) : (
                    <></>
                )}
            </div>
        </div>
    );
};
export default TitleBarWindows;
