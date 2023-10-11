import { useEffect, useState } from 'react';
import { logo } from '../../pic/img';
import useSystem from '../hooks/useSystem';
import TitleBar from './TitleBar/TitleBar';
import { ProgressParam } from '../../main/controllers/ProgressController';
import FileT from '../lib/param/FileT';
import { pathToFile } from '../lib/FileParser';

const api = window.electron;

export interface HomePageProps {
    onFileChange: (file: FileT) => void;
}
const HomePage = ({ onFileChange }: HomePageProps) => {
    const appVersion = useSystem((s) => s.appVersion);
    const [recentPlaylists, setRecentPlaylists] = useState<ProgressParam[]>([]);
    useEffect(() => {
        const init = async () => {
            let playlists = await api.recentPlay(50);
            playlists = [
                ...playlists,
                ...playlists,
                ...playlists,
                ...playlists,
            ];
            setRecentPlaylists(playlists);
        };
        init();
    }, []);

    const handleClick = async (item: ProgressParam) => {
        if (item.filePath && item.filePath.length > 0) {
            const file = await pathToFile(item.filePath);
            onFileChange(file);
        }
        if (item.subtitlePath && item.subtitlePath.length > 0) {
            const file = await pathToFile(item.subtitlePath);
            onFileChange(file);
        }
    };

    return (
        <div className="w-full h-screen flex-1 bg-background flex justify-center items-center select-none">
            <TitleBar
                maximizable={false}
                className="fixed top-0 left-0 w-full z-50"
                windowsButtonClassName="hover:bg-titlebarHover"
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
            <div className="h-full flex-1 flex flex-col justify-center items-center bg-white/10 rounded-r-lg border-l border-background px-6 gap-6">
                <div className="w-full h-16" />
                <div className="w-full bg-white/10 hover:bg-white/20 px-4 h-16 rounded-lg border border-background flex items-center justify-start">
                    open files...
                </div>
                <div className="w-full flex-1 flex flex-col overflow-y-auto scrollbar-none">
                    {recentPlaylists.map((playlist) => (
                        <div
                            key={playlist.fileName}
                            onClick={() => handleClick(playlist)}
                            className="w-full px-4 h-16 flex-shrink-0 flex justify-center items-center  hover:bg-white/10 rounded-lg"
                        >
                            <div className=" h-full flex-1 flex justify-start items-center">
                                {playlist.fileName}
                            </div>
                            <div className="w-1/3 h-full flex justify-center items-center">
                                {playlist.progress}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="w-full h-16" />
            </div>
        </div>
    );
};

export default HomePage;
