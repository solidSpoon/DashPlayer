import { twMerge } from 'tailwind-merge';
import { useShallow } from 'zustand/react/shallow';
import React, { useEffect, useState } from 'react';
import { GoFile } from 'react-icons/go';
import Switch from '../Switch';
import usePlayerController from '../../hooks/usePlayerController';
import { cn } from '../../../utils/Util';
import { ProgressParam } from '../../../main/controllers/ProgressController';
import { pathToFile } from '../../lib/FileParser';
import useFile from '../../hooks/useFile';
import OpenFile from '../OpenFile';
import { WatchProjectVO } from '../../../db/service/WatchProjectService';
import WatchProjectItem from '../WatchProjectItem';
import WatchProjectBrowser from '../WatchProjectBrowser';

const api = window.electron;
const ControlCenter = () => {
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
        <div className={cn('w-full h-full flex gap-2 select-none')}>
            <div
                onClick={(e) => {
                    e.stopPropagation();
                }}
                className={twMerge(
                    'flex-1 flex flex-col gap-4 items-center justify-center p-10 bg-white rounded-lg'
                )}
            >
                <div className={cn('text-xl font-bold')}>控制中心</div>
                <div
                    className={cn(
                        'p-4 shadow-inner shadow-gray-200 rounded-lg bg-gray-100'
                    )}
                >
                    <Switch
                        checked={showEn}
                        onChange={() => changeShowEn()}
                        title="展示英文字幕"
                        className={cn('w-60 hover:bg-gray-50')}
                    />
                    <Switch
                        checked={showCn}
                        onChange={() => changeShowCn()}
                        title="展示中文字幕"
                        className={cn('w-60 hover:bg-gray-50')}
                    />
                    <Switch
                        checked={showWordLevel}
                        onChange={() => changeShowWordLevel()}
                        title="展示生词翻译"
                        className={cn('w-60 hover:bg-gray-50')}
                    />
                    <Switch
                        checked={singleRepeat}
                        onChange={() => changeSingleRepeat()}
                        title="单句循环"
                        className={cn('w-60 hover:bg-gray-50')}
                    />
                </div>
            </div>
            <div
                onClick={(e) => {
                    e.stopPropagation();
                }}
                className={twMerge(
                    'flex-1 flex flex-col gap-2 items-center justify-center p-10 bg-white rounded-lg '
                )}
            >
                <OpenFile
                    isDirectory={false}
                    />
                <OpenFile
                    isDirectory={true}
                />
                <WatchProjectBrowser />
            </div>
        </div>
    );
};

export default ControlCenter;
