import { GoFile } from 'react-icons/go';
import React, { useEffect, useState } from 'react';
import { VscFolder, VscFolderOpened, VscHistory } from 'react-icons/vsc';
import { WatchProjectVO } from '../../db/service/WatchProjectService';
import { cn } from '../../utils/Util';
import ListItem from './ListItem';
import useFile from '../hooks/useFile';

export interface WatchProjectBrowserProps {}

const api = window.electron;

const WatchProjectBrowser = () => {
    const [recentPlaylists, setRecentPlaylists] = useState<WatchProjectVO[]>(
        []
    );
    const playFile = useFile((s) => s.playFile);
    const videoFile = useFile((s) => s.currentVideo);
    useEffect(() => {
        const runEffect = async () => {
            const playlists = await api.recentWatch();
            setRecentPlaylists(playlists);
        };
        runEffect();
    }, []);
    const [currentProject, setCurrentProject] = useState<WatchProjectVO | null>(
        recentPlaylists.filter((p) => p.id === videoFile?.project_id)[0]
    );

    useEffect(() => {
        setCurrentProject(
            recentPlaylists.filter((p) => p.id === videoFile?.project_id)[0]
        );
    }, [recentPlaylists, videoFile]);
    return (
        <>
            <div
                className={cn(
                    'text-xl font-bold w-full flex flex-col'
                )}
            >
                {currentProject === null ? (
                    <>
                        <VscHistory />
                        最近播放
                    </>
                ) : (
                    <>
                        <VscFolderOpened />
                        {currentProject?.project_name}
                    </>
                )}
            </div>
            <div className="w-full flex-1 h-0 flex flex-col overflow-y-auto scrollbar-none text-sm">
                {currentProject === null &&
                    recentPlaylists.map((playlist) => {
                        const file = playlist.videos.filter(
                            (v) => v.id === playlist.current_video_id
                        )[0];
                        return (
                            <ListItem
                                onClick={() => {
                                    setCurrentProject(playlist);
                                }}
                                icon={<VscFolder />}
                                content={`${playlist.project_name} ${file?.video_name}`}
                            />
                        );
                    })}
                {currentProject !== null && (
                    <div className="w-full flex flex-col gap-2 overflow-y-scroll">
                        <ListItem
                            onClick={() => {
                                setCurrentProject(null);
                            }}
                            content="..."
                        />

                        {currentProject?.videos.map((video) => (
                            <ListItem
                                onClick={() => {
                                    playFile(video);
                                }}
                                content={video.video_name ?? ''}
                                key={video.id}
                                icon={<GoFile />}
                            />
                        ))}
                    </div>
                )}
            </div>
        </>
    );
};

export default WatchProjectBrowser;
