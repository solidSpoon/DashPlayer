import { cn } from '../../utils/Util';
import { GoFile } from 'react-icons/go';
import React, { useEffect, useState } from 'react';
import { WatchProjectVO } from '../../db/service/WatchProjectService';
import WatchProjectItem from './WatchProjectItem';
import { VscFolder, VscFolderOpened, VscHistory } from 'react-icons/vsc';
import ListItem from './ListItem';

export interface WatchProjectBrowserProps {

}

const api = window.electron;


const WatchProjectBrowser = () => {
    const [recentPlaylists, setRecentPlaylists] = useState<WatchProjectVO[]>([]);
    useEffect(() => {
        const runEffect = async () => {
            const playlists = await api.recentWatch();
            setRecentPlaylists(playlists);
        };
        runEffect();
    }, []);
    const [currentProject, setCurrentProject] = useState<WatchProjectVO | null>(null);
    return <>
        <div className={cn('text-xl font-bold w-full flex justify-start gap-2')}>
            {currentProject === null ? (<>
                <VscHistory />
                最近播放
            </>) : (
                <>
                    <VscFolderOpened />
                    {currentProject.project_name}
                </>
            )}
        </div>
        <div className='w-full flex-1 flex flex-col overflow-y-auto scrollbar-none text-sm'>
            {currentProject === null && recentPlaylists.map((playlist) => {
                const file = playlist.videos.filter(v => v.id === playlist.current_video_id)[0];
                return <ListItem
                    onClick={() => {
                        setCurrentProject(playlist);
                    }}
                    icon={<VscFolder />}
                    content={playlist.project_name + ' ' + file?.video_name}
                />;
            })}
            {currentProject !== null &&
                <div className='w-full flex flex-col gap-2'>
                    <ListItem
                        onClick={() => {
                            setCurrentProject(null);
                        }}
                        content={'...'}
                    />

                    {currentProject?.videos.map((video) => (
                        <ListItem content={video.video_name ?? ''} key={video.id} icon={<GoFile />} />
                    ))}
                </div>}
        </div>
    </>;
};

export default WatchProjectBrowser;
