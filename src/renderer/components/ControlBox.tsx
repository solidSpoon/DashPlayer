import { twMerge } from 'tailwind-merge';
import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AiOutlineFieldTime } from 'react-icons/ai';
import toast, { Toaster } from 'react-hot-toast';
import { cn } from '../../common/utils/Util';
import Switch from './Switch';
import usePlayerController from '../hooks/usePlayerController';
import useLayout, { cpH, cpW } from '../hooks/useLayout';
import Button from './Button';
import { sentenceClearAllAdjust } from '../hooks/usePlayerControllerSlices/createSentenceSlice';

const ControlBox = () => {
    const w = cpW.bind(
        null,
        useLayout((s) => s.width)
    );
    const h = cpH.bind(
        null,
        useLayout((s) => s.height)
    );
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
                'flex justify-center items-center gap-4 p-8 rounded-lg w-full h-full text-black flex-col',
                'drop-shadow-lg  bg-white/90',
                h('md') && 'gap-1 p-2',
                h('xl') && 'gap-4 p-8'
            )}
        >
            <div className={cn('text-xl font-bold w-full')}>控制中心</div>
            <div
                className={cn(
                    'flex gap-6 flex-wrap items-center justify-start  flex-1 w-full h-0 overflow-auto',
                    'scrollbar-thin scrollbar-thumb-gray-300 scrollbar-thumb-rounded scrollbar-track-gray-100 scrollbar-track-rounded'
                )}
            >
                <Switch
                    checked={showEn}
                    onChange={() => changeShowEn()}
                    title="展示英文字幕"
                    className={cn('w-60 rounded')}
                />
                <Switch
                    checked={showCn}
                    onChange={() => changeShowCn()}
                    title="展示中文字幕"
                    className={cn('w-60 rounded')}
                />
                <Switch
                    checked={showWordLevel}
                    onChange={() => changeShowWordLevel()}
                    title="展示生词翻译"
                    className={cn('w-60 rounded-l-lg')}
                />
                <Switch
                    checked={singleRepeat}
                    onChange={() => changeSingleRepeat()}
                    title="单句循环"
                    className={cn('w-60 rounded')}
                />
                <Button
                    onClick={() => {
                        sentenceClearAllAdjust();
                        toast('清除了', {
                            icon: '👏',
                        });
                    }}
                    title="清除调整的时间"
                    className={cn('w-60 rounded')}
                >
                    <AiOutlineFieldTime />
                </Button>
            </div>
        </div>
    );
};

export default ControlBox;
