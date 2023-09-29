import React, { useEffect } from 'react';
import { AiOutlineClose, AiOutlineCompress, AiOutlineMinus } from "react-icons/ai";
import { FiMaximize } from 'react-icons/fi';

const api = window.electron;

const TitleBarSettingWindows = () => {
    const [isMaximized, setIsMaximized] = React.useState(false);

    useEffect(() => {
        const init = async () => {
            const isM = await api.isSettingMaximized();
            setIsMaximized(isM);
        };
        init();
        const removeMaximize = api.onSettingMaximize(() =>
            setIsMaximized(true)
        );
        const removeUnMaximize = api.onSettingUnMaximize(() =>
            setIsMaximized(false)
        );

        return () => {
            removeMaximize();
            removeUnMaximize();
        };
    });

    const maximize = async () => {
        await api.maximizeSetting();
    };

    const unMaximize = async () => {
        await api.unMaximizeSetting();
    };

    const onMinimize = async () => {
        await api.minimizeSetting();
    };

    const onClose = async () => {
        await api.closeSetting();
    };

    return (
        <div className="select-none w-full drag h-6 flex  justify-end items-center bg-stone-200 text-neutral-900 gap-x-2 drop-shadow">
            <div className="no-drag flex h-full justify-center items-center">
                <AiOutlineMinus
                    className="hover:bg-neutral-300 w-6 h-6 p-1"
                    onClick={onMinimize}
                />
                {isMaximized ? (
                    <AiOutlineCompress
                        className="hover:bg-neutral-300 w-6 h-6 p-[5px]"
                        onClick={unMaximize}
                    />
                ) : (
                    <FiMaximize
                        className="hover:bg-neutral-300 w-6 h-6 p-[5px]"
                        onClick={maximize}
                    />
                )}

                <AiOutlineClose
                    className="hover:bg-neutral-300 w-6 h-6 p-1"
                    onClick={onClose}
                />
            </div>
        </div>
    );
};
export default TitleBarSettingWindows;
