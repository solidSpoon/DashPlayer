import { useEffect, useState } from 'react';
import { WatchProjectVO } from '../../db/service/WatchProjectService';
import useFile from './useFile';

const api = window.electron;
const useProjectBrowser = () => {
    const [recentPlaylists, setRecentPlaylists] = useState<WatchProjectVO[]>(
        []
    );
    const videoFile = useFile((s) => s.currentVideo);
    const [currentProject, setCurrentProject] = useState<WatchProjectVO | null>(null);
    useEffect(() => {
        const runEffect = async () => {
            const playlists = await api.recentWatch();
            setRecentPlaylists(playlists);
        };
        runEffect();
    }, []);

    useEffect(() => {
        setCurrentProject(
            recentPlaylists.filter((p) => p.id === videoFile?.project_id)[0]
        );
    }, [recentPlaylists, videoFile]);
    const playList = !currentProject ?
        recentPlaylists :
        recentPlaylists
            .filter(p=>p.id === currentProject?.id);
    const routeTo = (projectId: number | undefined | null) => {
        if (projectId) {
            const project = playList.filter((p) => p.id === projectId)[0];
            if (project) {
                setCurrentProject(project);
            }
        } else {
            setCurrentProject(null);
        }
    }

    return {
        recentPlaylists,
        currentProject,
        routeTo,
    };
}

export default useProjectBrowser;
