import {AnimatePresence, motion} from 'framer-motion';
import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {useLocation, useParams, useSearchParams} from 'react-router-dom';
import useLayout, {cpW} from '@/fronted/hooks/useLayout';
import {cn} from '@/common/utils/Util';
import FileBrowser from '@/fronted/components/FileBrowser';
import ControlBox from '@/fronted/components/ControlBox';
import UploadButton from '@/fronted/components/UploadButton';
import useFile from '@/fronted/hooks/useFile';
import PlayerShortCut from '@/fronted/components/short-cut/PlayerShortCut';
import SideBar from '@/fronted/components/SideBar';
import Chat from '@/fronted/components/chat/Chat';
import useChatPanel from '@/fronted/hooks/useChatPanel';
import useSWR from 'swr';
import {pathToFile} from '@/common/utils/FileParser';
import {WatchProjectVideo} from '@/backend/db/tables/watchProjectVideos';
import PlayerPPlayer from '@/fronted/components/PlayerPPlayer';
import {SWR_KEY, swrMutate} from '@/fronted/lib/swr-util';

const api = window.electron;


const SWR_VIDEO = 'player-p';
const fetchVideo = async (videoId: number) => {
    const video = await api.call('watch-project/video/detail', Number(videoId));
    console.log('video', video);
    return video;
}

const PlayerP = () => {
    const {videoId} = useParams();
    const {data: video} = useSWR<WatchProjectVideo>(`${SWR_VIDEO}:${videoId}`, fetchVideo.bind(null, Number(videoId)));
    console.log('playerp', videoId, video);
    const showSideBar = useLayout((state) => state.showSideBar);
    const titleBarHeight = useLayout((state) => state.titleBarHeight);
    const chatTopic = useChatPanel(s => s.topic);
    const w = cpW.bind(
        null,
        useLayout((s) => s.width)
    );
    const h = cpW.bind(
        null,
        useLayout((s) => s.height)
    );
    const location = useLocation();
    const sideBarAnimation =
        (new URLSearchParams(location.search).get('sideBarAnimation') ??
            'true') === 'true';
    const [_searchParams, setSearchParams] = useSearchParams();
    const referrer = location.state && location.state.referrer;
    console.log('referrer', referrer);
    useEffect(() => {
        const runEffect = async () => {
            if (!video) {
                return;
            }
            useFile.setState({videoId: video.id, projectId: video.project_id});
            const vf = useFile.getState().videoFile;
            const sf = useFile.getState().subtitleFile;
            if (video.video_path && vf?.path !== video.video_path) {
                const file = await pathToFile(video.video_path);
                useFile.getState().updateFile(file);
            }
            if (video.subtitle_path && sf?.path !== video.subtitle_path) {
                const file = await pathToFile(video.subtitle_path);
                useFile.getState().updateFile(file);
            }
            await api.call('watch-project/video/play', video.id);
            // await swrMutate(SWR_KEY.WATCH_PROJECT_LIST);
        };
        runEffect();
    }, [video]);
    useEffect(() => {
        setSearchParams({sideBarAnimation: 'true'});
    }, [setSearchParams]);
    const posRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({x: 0, y: 0, scale: 1});
    useLayoutEffect(() => {
        const updatePos = () => {
            if (posRef.current === null) {
                return;
            }
            const rect = posRef.current.getBoundingClientRect();
            setPos({
                x: rect.x,
                y:
                    rect.y -
                    titleBarHeight +
                    (window.innerHeight - titleBarHeight) * 0.05,
                scale: rect.width / window.innerWidth
            });
        };
        updatePos();
        window.addEventListener('resize', updatePos);
        return () => {
            window.removeEventListener('resize', updatePos);
        };
    }, [titleBarHeight]);

    const showPlayer = w('md') && h('md');
    // useEffect(() => {
    //     console.log('eeeeeeesize', size);
    // }, [size]);
    const gridTemplate = () => {
        if (showPlayer && w('xl')) {
            return '15% 60% 25%';
        }
        if (showPlayer) {
            return '65px calc((100% - 65px) * 12 / 17) calc((100% - 65px) * 5 / 17)';
        }
        if (!showPlayer && w('xl')) {
            return '15% 42.5% 42.5%';
        }
        return '65px calc((100% - 65px) * 1 / 2) calc((100% - 65px) * 1 / 2)';
    };
    return (
        <div className={cn('relative w-full h-full ')}>
            <div
                className="absolute inset-0 grid grid-cols-3 grid-rows-2 overflow-hidden"
                style={{
                    gridTemplateColumns: gridTemplate(),
                    gridTemplateRows: '30% 70%' // 这里定义每行的大小
                }}
            >
                {showSideBar && (
                    <>
                        <motion.div
                            className={cn(
                                'col-start-1 col-end-2 row-start-1 row-end-3'
                            )}
                            initial={{x: -1000}}
                            animate={{
                                x: 0
                            }}
                            exit={{x: -1000}}
                            transition={{
                                type: 'tween',
                                duration: sideBarAnimation ? 0 : 0
                            }}
                        >
                            <SideBar compact={!w('xl')}/>
                        </motion.div>
                        <motion.div
                            className={cn(
                                'col-start-2 row-start-1 col-end-4 row-end-3 p-2',
                                h('md') && 'row-start-2',
                                w('md') && 'row-start-1 col-start-3 pl-1'
                            )}
                            initial={{x: 1000}}
                            animate={{
                                x: 0
                            }}
                            exit={{x: 1000}}
                            transition={{
                                type: 'tween',
                                duration: 0.2
                            }}
                        >
                            <FileBrowser/>
                        </motion.div>

                        <motion.div
                            className={cn(
                                'hidden row-start-1 row-end-3 col-start-2  col-end-4 p-2',
                                w('md') && 'block col-end-3',
                                h('md') && 'block row-end-2'
                            )}
                            initial={{y: -1000}}
                            animate={{
                                y: 0,
                                x: 0
                            }}
                            exit={{y: -1000}}
                            transition={{
                                type: 'tween',
                                duration: 0.2
                            }}
                        >
                            <ControlBox/>
                        </motion.div>
                    </>
                )}
                <div
                    className="p-4"
                    style={{
                        gridArea: '2 / 2 / 2 / 3'
                    }}
                >
                    <div className="w-full h-full" ref={posRef}/>
                </div>
                <div
                    className={cn(
                        'flex flex-col',
                        showSideBar && 'p-4 pt-2 pr-2',
                        !((w('md') && h('md')) || !showSideBar) && 'hidden'
                    )}
                    style={{
                        gridArea: '1 / 1 / -1 / -1',
                        transform: showSideBar
                            ? `translate(${pos.x}px, ${pos.y}px) scale(${pos.scale})`
                            : 'translate(0px, 0px) scale(1)',
                        transformOrigin: 'top left'
                    }}
                >
                    <PlayerPPlayer/>
                </div>
                {chatTopic === 'offscreen' && (
                    <>
                        <UploadButton/>
                        <PlayerShortCut/>
                    </>
                )}
                <AnimatePresence>
                    {chatTopic !== 'offscreen' && <Chat/>}
                </AnimatePresence>

            </div>
        </div>
    )
        ;
};

export default PlayerP;
