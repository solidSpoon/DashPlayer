import React from 'react';
import { VscChromeClose, VscChromeMinimize } from 'react-icons/vsc';

const api = window.electron;

const TitleBarSettingWindows = () => {
    const onMinimize = async () => {
        await api.minimizeSetting();
    };

    const onClose = async () => {
        await api.closeSetting();
    };

    return (
        <div className="fixed top-0 left-0 select-none w-full drag h-10 pb-4 flex justify-end items-center  z-50">
            <div className="no-drag flex h-full justify-center items-center">
                <VscChromeMinimize
                    className="hover:bg-neutral-300 w-6 h-6 p-1"
                    onClick={onMinimize}
                />
                <VscChromeClose
                    className="hover:bg-neutral-300 w-6 h-6 p-1"
                    onClick={onClose}
                />
            </div>
        </div>
    );
};
export default TitleBarSettingWindows;
