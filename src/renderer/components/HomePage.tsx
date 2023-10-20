import React, { useEffect, useRef, useState } from 'react';
import { GoFile, GoHistory } from 'react-icons/go';
import { logo } from '../../pic/img';
import useSystem from '../hooks/useSystem';
import TitleBar from './TitleBar/TitleBar';
import { ProgressParam } from '../../main/controllers/ProgressController';
import parseFile, { pathToFile } from '../lib/FileParser';
import { secondToDate } from './PlayTime';
import useFile from '../hooks/useFile';
import loading from '../../pic/loading.svg';

const api = window.electron;

const HomePage = () => {
    const appVersion = useSystem((s) => s.appVersion);
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
        <div className="w-full h-screen flex-1 bg-background flex justify-center items-center select-none overflow-hidden">
            <TitleBar
                maximizable={false}
                className="fixed top-0 left-0 w-full z-50"
                windowsButtonClassName="hover:bg-titlebarHover"
                autoHideOnMac={false}
            />
            <div className="w-1/3 h-full flex flex-col justify-center items-center bg-white/20 rounded-l-lg gap-14 drop-shadow shadow-black">
                <div className="relative top-0 left-0 w-32 h-32">
                    <img
                        src={logo}
                        alt="logo"
                        className="w-32 h-32 absolute top-0 left-0 user-drag-none"
                    />
                </div>
                <div className="flex flex-col items-center justify-center gap-2">
                    <h2 className="text-lg text-white/80">DashPlayer</h2>
                    <text className="text-white/75">{appVersion}</text>
                </div>
                <div className="w-full h-16" />
            </div>
            <div className="h-full flex-1 w-0 flex flex-col justify-center items-center bg-white/10 rounded-r-lg border-l border-background pl-8 pr-10 gap-6">
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
                    className="w-full hover:bg-white/10 px-4 h-12 rounded-lg flex items-center justify-start"
                >
                    Open Files...
                </div>
                {lastPlay && (
                    <div
                        onClick={() => handleClick(lastPlay)}
                        className="w-full bg-white/10 hover:bg-white/20 px-4 h-12 rounded-lg flex items-center justify-start gap-2 text-sm"
                    >
                        <GoHistory className="w-4 h-4 fill-neutral-400" />
                        <span>Resume</span>
                        <span className="flex-1 truncate">
                            {lastPlay.fileName}
                        </span>
                        <span className="text-neutral-400">
                            {secondToDate(lastPlay.progress)}
                        </span>
                    </div>
                )}
                <div className="w-full flex-1 flex flex-col overflow-y-auto scrollbar-none text-sm">
                    {restPlay.map((playlist) => (
                        <div
                            key={playlist.fileName}
                            onClick={() => handleClick(playlist)}
                            className="w-full h-10 flex-shrink-0 flex justify-center items-center hover:bg-white/5 rounded-lg gap-3 px-6"
                        >
                            <GoFile className="w-4 h-4 fill-yellow-400/70" />
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
