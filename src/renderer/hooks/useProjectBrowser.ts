import { useEffect, useState } from 'react';
import useFile from './useFile';
import { WatchProjectVO } from '../../db/services/WatchProjectService';
import { WatchProjectVideo } from '../../db/tables/watchProjectVideos';

const api = window.electron;

export interface UseProjectBrowserProps {
    onPlay: (videoId: number) => void;
}

export interface BrowserItem {
    key: string;
    icon: 'file' | 'folder';
    name: string;
    playing: boolean;
    callback: () => void;
}

function isSingleVideo(recentPlaylists: WatchProjectVO[], routeProject: number) {
    const cp = recentPlaylists.find((p) => p.id === routeProject)!;
    let single = (cp?.videos?.length ?? 0) > 1;
    return { cp, single };
}

const useProjectBrowser = (click: 'play' | 'route', onPlay: (videoId: number) => void) => {
    const [recentPlaylists, setRecentPlaylists] = useState<WatchProjectVO[]>(
        []
    );
    useEffect(() => {
        const runEffect = async () => {
            const playlists = await api.recentWatch();
            setRecentPlaylists(playlists);
        };
        runEffect();
    }, []);
    const videoFile = useFile((s) => s.currentVideo);
    const [routeProject, setRouteProject] = useState<number | null>(videoFile?.project_id ?? null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setRouteProject(videoFile?.project_id ?? null);
    }, [videoFile]);

    const routeTo = (projectId: number | undefined | null) => {
        setRouteProject(projectId ?? null);
    };
    const refresh = async () => {
        setLoading(true);
        const playlists = await api.reloadRecentFromDisk();
        setRecentPlaylists(playlists);
        setLoading(false);
    };
    const mapVideos = (v: WatchProjectVO): BrowserItem[] => {
        return (v.videos ?? []).map((v) => {
            return {
                key: v.id.toString(),
                icon: 'file',
                name: v.video_name,
                playing: v.id === videoFile?.id,
                callback: () => {
                    onPlay(v.id);
                }
            };
        });
    };

    const mapProject = (p: WatchProjectVO): BrowserItem => {
        const single = p.videos.length === 1;
        const video: WatchProjectVideo = p.videos.find(e => e.current_playing) ?? p.videos[0];
        let callBack = click === 'play' ? () => onPlay(video?.id) : () => routeTo(p.id);
        return {
            key: p.id.toString() + (single ? 's' : ''),
            icon: single ? 'file' : 'folder',
            name: p.project_name,
            playing: p.videos.find(e => e.id === videoFile?.id) !== undefined,
            callback: () => {
                single ? onPlay(video?.id) : callBack();
            }
        };
    };


    const list: BrowserItem[] = [];
    if (routeProject !== null) {
        let { cp, single } = isSingleVideo(recentPlaylists, routeProject);
        if (single) {
            list.push(...mapVideos(cp));
        } else {
            recentPlaylists.forEach((p) => {
                list.push(mapProject(p));
            });
        }
    } else {
        recentPlaylists.forEach((p) => {
            list.push(mapProject(p));
        });
    }

    return {
        list,
        refresh,
        loading,
        routeTo,
        path: recentPlaylists.find((p) => p.id === routeProject)?.project_name,
    };
};

export default useProjectBrowser;
