import React, { ReactElement, useEffect, useRef, useState } from 'react';
import ReactPlayer from 'react-player';
import FileT from '../lib/param/FileT';
import { SeekTime, SPACE_NUM } from '../hooks/useSubTitleController';
import { Action, jumpTime, space } from '../lib/CallAction';
import useFile from '../hooks/useFile';

interface PlayerParam {
    seekTime: SeekTime;
    onProgress: (time: number) => void;
    onTotalTimeChange: (time: number) => void;
    onAction: (action: Action) => void;
}

const api = window.electron;

export default function Player({
    seekTime,
    onProgress,
    onTotalTimeChange,
    onAction,
}: PlayerParam): ReactElement {
    const videoFile = useFile((s) => s.videoFile);
    const loadedVideo = useFile((s) => s.loadedVideo);
    const videoLoaded = useFile((s) => s.videoLoaded);
    const playerRef: React.RefObject<ReactPlayer> = useRef<ReactPlayer>(null);
    const playerRefBackground: React.RefObject<HTMLCanvasElement> =
        useRef<HTMLCanvasElement>(null);
    let lastFile: FileT | undefined;

    const lastSeekTime = useRef<SeekTime>({ time: 0 });

    const [showControlPanel, setShowControlPanel] = useState<boolean>(false);

    const shouldPause = seekTime.time === SPACE_NUM;
    if (!shouldPause && lastSeekTime.current !== seekTime) {
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
    }, [shouldPause, videoLoaded]);

    const jumpToHistoryProgress = async (file: FileT) => {
        if (file === lastFile) {
            return;
        }

        if (videoFile?.fileName === undefined) {
            return;
        }
        const result = await api.queryProgress(videoFile.fileName);
        const progress = result as number;
        onAction(jumpTime(progress));
        lastFile = file;
    };

    const render = (): ReactElement => {
        if (videoFile === undefined) {
            return <div />;
        }
        return (
            <div
                className="w-full h-full overflow-hidden"
                onDoubleClick={() => setShowControlPanel(true)}
                onMouseLeave={() => setShowControlPanel(false)}
            >
                <div className="w-full h-full relative overflow-hidden">
                    <canvas
                        className="absolute top-0 left-0 w-full h-full -z-0"
                        ref={playerRefBackground}
                        style={{
                            filter: 'blur(100px)',
                            // transform: 'scale(1.1)',
                            objectFit: 'cover',
                        }}
                    />
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <ReactPlayer
                        className="w-full h-full absolute top-0 left-0 z-0"
                        id="react-player-id"
                        ref={playerRef}
                        url={videoFile.objectUrl ? videoFile.objectUrl : ''}
                        playing={!shouldPause}
                        controls={showControlPanel}
                        width="100%"
                        height="100%"
                        progressInterval={50}
                        config={{
                            file: {
                                attributes: {
                                    controlsList: 'nofullscreen',
                                },
                            },
                        }}
                        onPlay={() => {
                            if (shouldPause) {
                                onAction(space());
                            }
                        }}
                        onPause={() => {
                            if (!shouldPause) {
                                onAction(space());
                            }
                        }}
                        onProgress={(progress) => {
                            onProgress(progress.playedSeconds);
                        }}
                        onDuration={(duration) => {
                            onTotalTimeChange(duration);
                        }}
                        onStart={() => {
                            loadedVideo(videoFile);
                            jumpToHistoryProgress(videoFile);
                        }}
                    />
                </div>
            </div>
        );
    };

    return render();
}
