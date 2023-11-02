import { twMerge } from 'tailwind-merge';
import { useShallow } from 'zustand/react/shallow';
import { useState } from 'react';
import Switch from '../Switch';
import usePlayerController from '../../hooks/usePlayerController';
import { cn } from '../../../utils/Util';
import useSetting from '../../hooks/useSetting';
import ControlCenter from './ControlCenter';
import WordLevelPage from './WordLevelPage';

const ControllerPage = () => {
    const theme = useSetting((s) => s.appearance.theme);
    const { changePopType } = usePlayerController(
        useShallow((s) => ({
            changePopType: s.changePopType,
        }))
    );

    const [pageType, setPageType] = useState<'control-center' | 'word-level'>(
        'control-center'
    );

    return (
        <div
            onClick={() => {
                changePopType('none');
            }}
            className={twMerge(
                'fixed left-0 top-0 flex flex-col items-center justify-center z-50 w-full h-full text-black',
                theme
            )}
        >
            <div className="h-7 w-full" />

            <div className="flex-1 w-full px-2 pb-2 bg-titlebar">
                <div
                    className={cn(
                        'w-full h-full flex flex-col bg-gray-200 rounded overflow-hidden shadow-inner shadow-gray-300'
                    )}
                >
                    <div
                        className={cn(
                            'w-full flex items-center justify-center bg-white p-2 select-none'
                        )}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div
                            className={cn(
                                'bg-gray-200 rounded-lg p-1 flex items-center justify-center gap-1 shadow-inner shadow-gray-300'
                            )}
                        >
                            <div
                                onClick={() => {
                                    setPageType('control-center');
                                }}
                                className={cn(
                                    'px-2 h-8 border-gray-200 rounded drop-shadow flex items-center justify-center cursor-default text-gray-500',
                                    pageType === 'control-center' &&
                                        'bg-white text-black'
                                )}
                            >
                                Control Center
                            </div>{' '}
                            <div
                                onClick={() => {
                                    setPageType('word-level');
                                }}
                                className={cn(
                                    'px-2 h-8 border-gray-200 rounded drop-shadow flex items-center justify-center cursor-default text-gray-500',
                                    pageType === 'word-level' &&
                                        'bg-white text-black'
                                )}
                            >
                                Word Level
                            </div>
                        </div>
                    </div>
                    <div
                        className={cn(
                            ' flex-1 flex items-center justify-center p-2 drop-shadow-lg'
                        )}
                    >
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                            }}
                            className={twMerge(
                                'w-full h-full bg-white rounded-lg overflow-hidden'
                            )}
                        >
                            {pageType === 'control-center' && <ControlCenter />}
                            {pageType === 'word-level' && <WordLevelPage />}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ControllerPage;
