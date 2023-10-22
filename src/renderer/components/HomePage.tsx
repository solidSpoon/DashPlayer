import React, { useEffect, useRef, useState } from 'react';
import { GoFile, GoHistory } from 'react-icons/go';
import { twMerge } from 'tailwind-merge';
import { logo } from '../../pic/img';
import useSystem from '../hooks/useSystem';
import TitleBar from './TitleBar/TitleBar';
import { ProgressParam } from '../../main/controllers/ProgressController';
import parseFile, { pathToFile } from '../lib/FileParser';
import { secondToDate } from './PlayTime';
import useFile from '../hooks/useFile';
import loading from '../../pic/loading.svg';
import useSetting, { usingThemeName } from '../hooks/useSetting';
import { THEME } from '../../types/Types';
import { cn } from '../../utils/Util';

const api = window.electron;

const HomePage = () => {
    const appVersion = useSystem((s) => s.appVersion);
    const theme = useSetting((s) => s.appearance.theme);
    const dark =
        THEME[THEME.map((t) => t.name).indexOf(theme) ?? 0].type === 'dark';
    const [recentPlaylists, setRecentPlaylists] = useState<ProgressParam[]>([]);
    const fileInputEl = useRef<HTMLInputElement>(null);
    const [currentClick, setCurrentClick] = useState<string | undefined>(
        undefined
    );
    const onFileChange = useFile((s) => s.updateFile);
    useEffect(() => {
        const init = async () => {
            const playlists = await api.recentPlay(50);
            setRecentPlaylists(playlists);
        };
        init();
    }, []);
    const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files ?? [];
        for (let i = 0; i < files.length; i += 1) {
            const file = parseFile(files[i]);
            onFileChange(file);
        }
    };
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

    const lastPlay =
        recentPlaylists.length > 0 ? recentPlaylists[0] : undefined;
    const restPlay = recentPlaylists.length > 1 ? recentPlaylists.slice(1) : [];

    return (
        <div
            className={cn(
                'w-full h-screen flex-1 flex justify-center items-center select-none overflow-hidden text-black/80',
                !dark &&
                    'bg-gradient-to-br from-orange-500/50  via-red-500/50 to-rose-500/50',
                dark && 'bg-neutral-800 text-white/80'
            )}
        >
            <TitleBar
                maximizable={false}
                className="fixed top-0 left-0 w-full z-50"
                windowsButtonClassName={cn(
                    'text-slate-700 hover:bg-slate-300',
                    dark && 'hover:bg-titlebarHover'
                )}
                autoHideOnMac={false}
            />
            <div
                className={cn(
                    'w-1/3 h-full backdrop-blur flex flex-col justify-center items-center bg-white/20 rounded-l-lg gap-14 drop-shadow shadow-white',
                    dark && 'shadow-black'
                )}
            >
                <div className="relative top-0 left-0 w-32 h-32">
                    <img
                        src={logo}
                        alt="logo"
                        className="w-32 h-32 absolute top-0 left-0 user-drag-none"
                    />
                </div>
                <div className="flex flex-col items-center justify-center gap-2">
                    <h2
                        className={cn(
                            'text-lg text-black/80',
                            dark && 'text-white/80'
                        )}
                    >
                        DashPlayer
                    </h2>
                    <text
                        className={cn('text-black/75', dark && 'text-white/75')}
                    >
                        {appVersion}
                    </text>
                </div>
                <div className="w-full h-16" />
            </div>
            <div
                className={cn(
                    'h-full flex-1 backdrop-blur w-0 flex flex-col justify-center items-center bg-stone-300/50 rounded-r-lg border-l border-stone-400 pl-8 pr-10 gap-6',
                    dark && 'border-neutral-800 bg-white/10'
                )}
            >
                <div className="w-full h-10" />
                <input
                    type="file"
                    multiple
                    ref={fileInputEl} // 挂载ref
                    accept=".mp4,.mkv,.srt,.webm" // 限制文件类型
                    hidden // 隐藏input
                    onChange={(event) => handleFile(event)}
                />
                <div
                    onClick={() => fileInputEl.current?.click()}
                    className={cn(
                        'w-full hover:bg-black/10 px-4 h-12 rounded-lg flex items-center justify-start',
                        dark && 'hover:bg-white/10'
                    )}
                >
                    Open Files...
                </div>
                {lastPlay && (
                    <div
                        onClick={() => handleClick(lastPlay)}
                        className={cn(
                            'w-full bg-black/10 hover:bg-black/20 px-4 h-12 rounded-lg flex items-center justify-start gap-2 text-sm',
                            dark && 'bg-white/10 hover:bg-white/20'
                        )}
                    >
                        <GoHistory
                            className={cn(
                                'w-4 h-4 fill-neutral-600',
                                dark && 'fill-neutral-400'
                            )}
                        />
                        <span>Resume</span>
                        <span className="flex-1 truncate">
                            {lastPlay.fileName}
                        </span>
                        <span
                            className={cn(
                                'text-neutral-600',
                                dark && 'text-neutral-400'
                            )}
                        >
                            {secondToDate(lastPlay.progress)}
                        </span>
                    </div>
                )}
                <div className="w-full flex-1 flex flex-col overflow-y-auto scrollbar-none text-sm">
                    {restPlay.map((playlist) => (
                        <div
                            key={playlist.fileName}
                            onClick={() => handleClick(playlist)}
                            className={cn(
                                'w-full h-10 flex-shrink-0 flex justify-center items-center hover:bg-black/5 rounded-lg gap-3 px-6',
                                dark && 'hover:bg-white/5'
                            )}
                        >
                            <GoFile
                                className={cn(
                                    'w-4 h-4 fill-yellow-700/90',
                                    dark && 'fill-yellow-400/70'
                                )}
                            />
                            <div className="w-full truncate">
                                {playlist.fileName}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="w-full h-16">
                    {currentClick && (
                        <img
                            src={loading}
                            alt="loading"
                            className="fixed bottom-1 right-1 w-8 h-8 bg-transparent"
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default HomePage;
