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
    const [loading, setLoading] = useState(false);
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
            const project = recentPlaylists.filter((p) => p.id === projectId)[0];
            console.log('routeTo', playList);
            if (project) {
                setCurrentProject(project);
            }
        } else {
            setCurrentProject(null);
        }
    }

    const refresh = async () => {
        setLoading(true);
        const playlists = await api.reloadRecentFromDisk();
        setRecentPlaylists(playlists);
        setLoading(false);
    }
    return {
        recentPlaylists,
        currentProject,
        routeTo,
        refresh,
        loading,
    };
}

export default useProjectBrowser;
