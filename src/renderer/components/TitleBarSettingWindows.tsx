import React, { useEffect, useState } from 'react';
import { AiOutlineClose, AiOutlineCloseSquare, AiOutlineMinus } from 'react-icons/ai';
import { GrClose, GrMenu } from 'react-icons/gr';
import { FaWindowMinimize } from 'react-icons/fa';
import { FiMaximize } from 'react-icons/fi';
import callApi from '../lib/apis/ApiWrapper';
import { BiMenu } from 'react-icons/bi';
import { HiOutlineMenu } from 'react-icons/hi';


const TitleBarSettingWindows = () => {
    const onMaximize = async () => {
        const isMaximized = (await callApi('is-maximized-setting', [])) as boolean;
        if (isMaximized) {
            await callApi('unmaximize-setting', []);
        } else {
            await callApi('maximize-setting', []);
        }
    };

    const onMinimize = async () => {
        await callApi('minimize-setting', []);
    };

    const onClose = async () => {
        await callApi('close-setting', []);
    };

    return (
        <div
            className={`select-none w-full drag h-7 flex  justify-end items-center bg-neutral-800 text-neutral-200 shadow-inner shadow-neutral-700 space-x-2 drop-shadow`}
        >
            <div className='no-drag flex space-x-2 h-full justify-center items-center'>
                <AiOutlineMinus
                    className='hover:bg-neutral-500 w-7 h-7 p-1'
                    onClick={onMinimize}
                />
                <FiMaximize
                    className='hover:bg-neutral-500 w-7 h-7 p-1'
                    onClick={onMaximize}
                />
                <AiOutlineClose
                    className='hover:bg-neutral-500 w-7 h-7 p-1'
                    onClick={onClose}
                />
            </div>

        </div>
    );
};
export default TitleBarSettingWindows;
