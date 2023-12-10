import { twMerge } from 'tailwind-merge';
import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '../../utils/Util';
import Switch from './Switch';
import usePlayerController from '../hooks/usePlayerController';

const ControlBox = () => {
    const {
        showEn,
        showCn,
        showWordLevel,
        singleRepeat,
        changeShowEn,
        changeShowCn,
        changeShowWordLevel,
        changeSingleRepeat,
        changePopType,
    } = usePlayerController(
        useShallow((s) => ({
            showEn: s.showEn,
            showCn: s.showCn,
            showWordLevel: s.showWordLevel,
            changeShowEn: s.changeShowEn,
            changeShowCn: s.changeShowCn,
            changeShowWordLevel: s.changeShowWordLevel,
            singleRepeat: s.singleRepeat,
            changeSingleRepeat: s.changeSingleRepeat,
            changePopType: s.changePopType,
        }))
    );

    return (
        <div
            className={twMerge(
                'flex gap-4 justify-center items-center p-8 rounded-lg w-full h-full text-black flex-col',
                'drop-shadow-lg  bg-white'
            )}
        >
            <div className={cn('text-xl font-bold w-full')}>控制中心</div>
            <div
                className={cn(
                    'flex flex-col gap-2 flex-wrap items-start justify-around p-4 rounded-lg flex-1 w-full h-0 overflow-x-auto'
                )}
            >
                <Switch
                    checked={showEn}
                    onChange={() => changeShowEn()}
                    title="展示英文字幕"
                    className={cn('w-60')}
                />
                <Switch
                    checked={showCn}
                    onChange={() => changeShowCn()}
                    title="展示中文字幕"
                    className={cn('w-60')}
                />
                <Switch
                    checked={showWordLevel}
                    onChange={() => changeShowWordLevel()}
                    title="展示生词翻译"
                    className={cn('w-60')}
                />
                <Switch
                    checked={singleRepeat}
                    onChange={() => changeSingleRepeat()}
                    title="单句循环"
                    className={cn('w-60')}
                />
            </div>
        </div>
    );
};

export default ControlBox;
