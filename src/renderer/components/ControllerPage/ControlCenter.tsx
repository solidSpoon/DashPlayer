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
    const [recentPlaylists, setRecentPlaylists] = useState<ProgressParam[]>([]);
    useEffect(() => {
        const init = async () => {
            const playlists = await api.recentPlay(50);
            setRecentPlaylists(playlists);
        };
        init();
    }, []);
    const [currentClick, setCurrentClick] = useState<string | undefined>(
        undefined
    );
    const onFileChange = useFile((s) => s.updateFile);
    const handleClick = async (item: ProgressParam) => {
        if (currentClick === item.filePath) {
            return;
        }
        setCurrentClick(item.filePath);
        if (item.filePath && item.filePath.length > 0) {
            const file = await pathToFile(item.filePath);
            onFileChange(file);
        }
        if (item.subtitlePath && item.subtitlePath.length > 0) {
            const file = await pathToFile(item.subtitlePath);
            onFileChange(file);
        }
        // currentClick.current = '';
    };
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
                <div className={cn('text-xl font-bold w-full')}>最近播放</div>
                <div className="w-full flex-1 flex flex-col overflow-y-auto scrollbar-none text-sm">
                    {recentPlaylists.map((playlist) => (
                        <div
                            key={playlist.fileName}
                            onClick={() => handleClick(playlist)}
                            className={cn(
                                'w-full h-10 flex-shrink-0 flex justify-center items-center hover:bg-black/5 rounded-lg gap-3 px-6'
                            )}
                        >
                            <GoFile
                                className={cn('w-4 h-4 fill-yellow-700/90')}
                            />
                            <div className="w-full truncate">
                                {playlist.fileName}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ControlCenter;
