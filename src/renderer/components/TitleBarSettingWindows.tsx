import React from 'react';
import { AiOutlineClose, AiOutlineMinus } from 'react-icons/ai';
import { FiMaximize } from 'react-icons/fi';

const api = window.electron;

const TitleBarSettingWindows = () => {
    const onMaximize = async () => {
        const isMaximized = await api.isSettingMaximized();
        if (isMaximized) {
            await api.unMaximizeSetting();
        } else {
            await api.maximizeSetting();
        }
    };

    const onMinimize = async () => {
        await api.minimizeSetting();
    };

    const onClose = async () => {
        await api.closeSetting();
    };

    return (
        <div className="select-none w-full drag h-7 flex  justify-end items-center bg-neutral-800 text-neutral-200 shadow-inner shadow-neutral-700 space-x-2 drop-shadow">
            <div className="no-drag flex space-x-2 h-full justify-center items-center">
                <AiOutlineMinus
                    className="hover:bg-neutral-500 w-7 h-7 p-1"
                    onClick={onMinimize}
                />
                <FiMaximize
                    className="hover:bg-neutral-500 w-7 h-7 p-1"
                    onClick={onMaximize}
                />
                <AiOutlineClose
                    className="hover:bg-neutral-500 w-7 h-7 p-1"
                    onClick={onClose}
                />
            </div>
        </div>
    );
};
export default TitleBarSettingWindows;
