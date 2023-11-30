import { twMerge } from 'tailwind-merge';
import { useShallow } from 'zustand/react/shallow';
import { useState } from 'react';
import Switch from '../Switch';
import usePlayerController from '../../hooks/usePlayerController';
import { cn } from '../../../utils/Util';
import useSetting from '../../hooks/useSetting';
import ControlCenter from './ControlCenter';
import WordLevelPage from './WordLevelPage';
import { IoMdClose } from 'react-icons/io';

const ControllerPage = () => {
    const theme = useSetting((s) => s.appearance.theme);
    const { popType, changePopType } = usePlayerController(
        useShallow((s) => ({
            popType: s.popType,
            changePopType: s.changePopType,
        }))
    );

    return (
        <div
            // onClick={() => {
            //     changePopType('none');
            // }}
            className={twMerge(
                'fixed left-0 top-0 flex flex-col items-center justify-center z-50 w-full h-full text-black',
                theme
            )}
        >
            <div className="h-7 w-full" />

            <div className="flex-1 w-full h-0 px-2 pb-2 bg-titlebar">
                <div
                    className={cn(
                        'w-full h-full flex flex-col bg-gray-200 rounded overflow-hidden shadow-inner shadow-gray-300'
                    )}
                >
                    <div
                        className={cn(
                            'w-full flex items-center justify-between bg-white p-2 select-none'
                        )}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div/>
                        <div
                            className={cn(
                                'bg-gray-200 rounded-lg p-1 flex items-center justify-center gap-1 shadow-inner shadow-gray-300'
                            )}
                        >
                            <div
                                onClick={() => {
                                    changePopType('control');
                                }}
                                className={cn(
                                    'px-2 h-8 border-gray-200 rounded drop-shadow flex items-center justify-center cursor-default text-gray-500',
                                    popType === 'control' &&
                                        'bg-white text-black'
                                )}
                            >
                                Control Center
                            </div>{' '}
                            <div
                                onClick={() => {
                                    changePopType('word');
                                }}
                                className={cn(
                                    'px-2 h-8 border-gray-200 rounded drop-shadow flex items-center justify-center cursor-default text-gray-500',
                                    popType === 'word' &&
                                        'bg-white text-black'
                                )}
                            >
                                Word Level
                            </div>
                        </div>
                        <div
                            onClick={() => {
                                changePopType('none');
                            }}
                            className={cn('shadow-inner bg-gray-200 shadow-gray-300 rounded p-2',
                            'hover:bg-gray-300 hover:shadow-gray-400 '
                            )}>
                            <IoMdClose />
                        </div>
                    </div>
                    <div
                        className={cn(
                            ' flex-1 h-0 flex items-center justify-center p-2 drop-shadow-lg'
                        )}
                    >
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                            }}
                            className={twMerge(
                                'w-full h-full rounded-lg overflow-hidden'
                            )}
                        >
                            {popType === 'control' && <ControlCenter />}
                            {popType === 'word' && <WordLevelPage />}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ControllerPage;
