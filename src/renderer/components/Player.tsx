import React, { ReactElement, useEffect, useRef, useState } from 'react';
import ReactPlayer from 'react-player';
import { useShallow } from 'zustand/react/shallow';
import FileT from '../lib/param/FileT';
import usePlayerController from '../hooks/usePlayerController';
import useFile from '../hooks/useFile';
import PlayerControlPannel from './PlayerControlPannel';
import { SeekAction } from '../hooks/usePlayerControllerSlices/SliceTypes';

const api = window.electron;

export default function Player(): ReactElement {
    const {
        playing,
        muted,
        volume,
        play,
        pause,
        seekTime,
        updateExactPlayTime,
        setDuration,
        seekTo,
        changePopType
    } = usePlayerController(
        useShallow((state) => ({
            playing: state.playing,
            muted: state.muted,
            volume: state.volume,
            play: state.play,
            pause: state.pause,
            seekTime: state.seekTime,
            updateExactPlayTime: state.updateExactPlayTime,
            setDuration: state.setDuration,
            seekTo: state.seekTo,
            changePopType: state.changePopType
        }))
    );
    const videoFile = useFile((s) => s.videoFile);
    const loadedVideo = useFile((s) => s.loadedVideo);
    const videoLoaded = useFile((s) => s.videoLoaded);
    const playerRef: React.RefObject<ReactPlayer> = useRef<ReactPlayer>(null);
    const playerRefBackground: React.RefObject<HTMLCanvasElement> =
        useRef<HTMLCanvasElement>(null);
    let lastFile: FileT | undefined;

    const lastSeekTime = useRef<SeekAction>({ time: 0 });

    const [showControlPanel, setShowControlPanel] = useState<boolean>(false);

    if (lastSeekTime.current !== seekTime) {
        lastSeekTime.current = seekTime;
        if (playerRef.current !== null) {
            playerRef.current.seekTo(seekTime.time, 'seconds');
        }
    }

    useEffect(() => {
        let animationFrameId: number | undefined;
        const syncVideos = async () => {
            const mainVideo = playerRef?.current;
            const backgroundCanvas = playerRefBackground?.current;

            if (mainVideo !== null && backgroundCanvas !== null) {
                const { width, height } =
                    backgroundCanvas.getBoundingClientRect();
                const ctx = backgroundCanvas.getContext('2d');
                if (ctx !== null) {
                    if (
                        backgroundCanvas.width !== width ||
                        backgroundCanvas.height !== height
                    ) {
                        const { devicePixelRatio: ratio = 1 } = window;
                        backgroundCanvas.width = width * ratio;
                        backgroundCanvas.height = height * ratio;
                        ctx.scale(ratio, ratio);
                    }

                    const canvasWidth = backgroundCanvas?.clientWidth ?? 0;
                    const canvasHeight = backgroundCanvas?.clientHeight ?? 0;
                    ctx?.drawImage(
                        mainVideo?.getInternalPlayer() as CanvasImageSource,
                        0,
                        0,
                        canvasWidth,
                        canvasHeight
                    );
                }
            }

            // 在每一帧中调用 syncVideos
            animationFrameId = requestAnimationFrame(syncVideos);
        };
        if (videoLoaded) {
            syncVideos();
        }
        return () => {
            if (animationFrameId !== undefined) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [videoLoaded]);

    const jumpToHistoryProgress = async (file: FileT) => {
        if (file === lastFile) {
            return;
        }

        if (videoFile?.fileName === undefined) {
            return;
        }
        const result = await api.queryProgress(videoFile.fileName);
        const progress = result.current_time ?? 0;
        console.log('jumpToHistoryProgress', progress);
        seekTo({ time: progress });
        lastFile = file;
    };

    const render = (): ReactElement => {
        if (videoFile === undefined) {
            return <div />;
        }
        return (
            <div
                className='w-full h-full overflow-hidden'
                onDoubleClick={() => changePopType('control')}
                onMouseLeave={() => setShowControlPanel(false)}
            >
                <div className='w-full h-full relative overflow-hidden'>
                    <canvas
                        className='absolute top-0 left-0 w-full h-full -z-0'
                        ref={playerRefBackground}
                        style={{
                            filter: 'blur(100px)',
                            // transform: 'scale(1.1)',
                            objectFit: 'cover'
                        }}
                    />
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <ReactPlayer
                        muted={muted}
                        className='w-full h-full absolute top-0 left-0 z-0'
                        id='react-player-id'
                        ref={playerRef}
                        url={videoFile.objectUrl ? videoFile.objectUrl : ''}
                        playing={playing}
                        controls={showControlPanel}
                        width='100%'
                        height='100%'
                        progressInterval={50}
                        volume={volume}
                        config={{
                            file: {
                                attributes: {
                                    controlsList: 'nofullscreen'
                                }
                            }
                        }}
                        onPlay={() => {
                            play();
                        }}
                        onPause={() => {
                            pause();
                        }}
                        onProgress={(progress) => {
                            updateExactPlayTime(progress.playedSeconds);
                        }}
                        onDuration={(duration) => {
                            setDuration(duration);
                        }}
                        onStart={async () => {
                            await jumpToHistoryProgress(videoFile);
                            loadedVideo(videoFile);
                        }}
                        onReady={() => {
                            if (!videoLoaded) {
                                play();
                            }
                        }}
                    />
                    {!showControlPanel && (
                        <PlayerControlPannel
                            onTimeChange={(time) => {
                                seekTo({ time });
                            }}
                            className='absolute bottom-0 left-0 px-3'
                            onPause={() => {
                                pause();
                            }}
                            onPlay={() => {
                                play();
                            }}
                            playing={playing}
                        />
                    )}
                </div>
            </div>
        );
    };

    return render();
}
