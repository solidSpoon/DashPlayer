import { useEffect, useState } from 'react';
import useFile from './useFile';
import { WatchProjectVO } from '../../db/services/WatchProjectService';
import { WatchProjectVideo } from '../../db/tables/watchProjectVideos';
import FileBrowserIcon from '../components/fileBowser/FileBrowserIcon';

const api = window.electron;
export type FileType = 'video' | 'folder';
export type WatchType = 'watched' | 'playing' | 'unwatched';
export interface BrowserItem {
    key: string;
    icon: keyof typeof FileBrowserIcon;
    name: string;
    playing: WatchType;
    callback: () => void;
}

function isSingleVideo(
    recentPlaylists: WatchProjectVO[],
    routeProject: number
) {
    const cp = recentPlaylists.find((p) => p.id === routeProject)!;
    const single = (cp?.videos?.length ?? 0) > 1;
    return { cp, single };
}

const useProjectBrowser = (
    click: 'play' | 'route',
    onPlay: (videoId: number) => void
) => {
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
    const [routeProject, setRouteProject] = useState<number | null>(
        videoFile?.project_id ?? null
    );
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
    const mapVideos = (watchProjectVO: WatchProjectVO): BrowserItem[] => {
        return (watchProjectVO.videos ?? []).map((v) => {
            let playing: WatchType =
                v.id === videoFile?.id ? 'playing' : 'unwatched';
            if (playing === 'unwatched') {
                playing = v.current_time > 5 ? 'watched' : 'unwatched';
            }
            let icon: keyof typeof FileBrowserIcon = 'video';
            if (playing === 'watched') {
                icon = 'videoWatched';
            }
            if (playing === 'playing') {
                icon = 'videoPlaying';
            }
            return {
                key: v.id.toString(),
                icon,
                name: v.video_name,
                playing,
                callback: () => {
                    onPlay(v.id);
                },
            };
        });
    };

    const mapProject = (p: WatchProjectVO): BrowserItem => {
        const single = p.videos.length === 1;
        const video: WatchProjectVideo =
            p.videos.find((e) => e.current_playing) ?? p.videos[0];
        const callBack =
            click === 'play' ? () => onPlay(video?.id) : () => routeTo(p.id);
        let playing: WatchType =
            video?.id === videoFile?.id ? 'playing' : 'unwatched';
        if (playing === 'unwatched') {
            playing = video?.current_time > 5 ? 'watched' : 'unwatched';
        }
        let icon: keyof typeof FileBrowserIcon = single ? 'video' : 'folder';
        if (playing === 'watched') {
            icon = single ? 'videoWatched' : 'folderWatched';
        }
        if (playing === 'playing') {
            icon = single ? 'videoPlaying' : 'folderPlaying';
        }
        return {
            key: p.id.toString() + (single ? 's' : ''),
            icon,
            name: p.project_name,
            playing,
            callback: () => {
                if (single) {
                    onPlay(video?.id);
                } else {
                    callBack();
                }
            },
        };
    };

    const list: BrowserItem[] = [];
    if (routeProject !== null) {
        const { cp, single } = isSingleVideo(recentPlaylists, routeProject);
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
