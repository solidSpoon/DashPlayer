import React, { ReactElement, useEffect, useRef, useState } from 'react';
import FileT from '../lib/param/FileT';
import callApi from '../lib/apis/ApiWrapper';
import { SeekTime } from '../hooks/useSubTitleController';
import { Action, jumpTime } from '../lib/CallAction';

interface PlayerParam {
    videoFile: FileT | undefined;
    seekTime: SeekTime;
    onProgress: (time: number) => void;
    onTotalTimeChange: (time: number) => void;
    onAction: (action: Action) => void;
    playingState: boolean;
    setPlayingState: (state: boolean) => void;
}

export default function Player({
    videoFile,
    seekTime,
    onProgress,
    onTotalTimeChange,
    playingState,
    setPlayingState,
    onAction,
}: PlayerParam): ReactElement {
    console.log('playingState:', playingState);

    const playerRef: React.RefObject<HTMLVideoElement> =
        useRef<HTMLVideoElement>(null);
    const playerRefBackground: React.RefObject<HTMLCanvasElement> =
        useRef<HTMLCanvasElement>(null);
    let lastFile: FileT | undefined;

    const lastSeekTime = useRef<SeekTime>({ time: 0 });

    const [showControlPanel, setShowControlPanel] = useState<boolean>(false);

    if (lastSeekTime.current !== seekTime) {
        console.log('seekTimeupdate');
        lastSeekTime.current = seekTime;
        if (playerRef.current !== null) {
            playerRef.current.currentTime = seekTime.time;
            playerRef.current.play();
        }
    } else if (playerRef.current !== null) {
        if (playingState && playerRef.current.paused) {
            playerRef.current.play();
        } else if (!playingState && !playerRef.current.paused) {
            playerRef.current.pause();
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

                    ctx?.drawImage(mainVideo, 0, 0, canvasWidth, canvasHeight);
                }
            }

            // 在每一帧中调用 syncVideos
            animationFrameId = requestAnimationFrame(syncVideos);
        };
        syncVideos();
        return () => {
            if (animationFrameId !== undefined) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [playingState]);

    const jumpToHistoryProgress = async (file: FileT) => {
        if (file === lastFile) {
            return;
        }

        if (videoFile === undefined) {
            return;
        }
        const result = await callApi('query-progress', [videoFile.fileName]);
        const progress = result as number;
        onAction(jumpTime(progress));
        lastFile = file;
    };

    const render = (): ReactElement => {
        if (videoFile === undefined) {
            return <></>;
        }
        return (
            <div
                className="w-full h-full mb-auto relative overflow-hidden"
                onDoubleClick={() => setShowControlPanel(true)}
                onMouseLeave={() => setShowControlPanel(false)}
            >
                <div className="absolute top-0 left-0 w-full h-full">
                    <canvas
                        className="w-full h-full"
                        ref={playerRefBackground}
                        style={{
                            filter: 'blur(100px)',
                            // transform: 'scale(1.1)',
                            objectFit: 'cover',
                        }}
                    />
                </div>
                <div className="absolute top-0 left-0 w-full h-full">
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <video
                        id="react-player-id"
                        ref={playerRef}
                        src={videoFile.objectUrl ? videoFile.objectUrl : ''}
                        controls={showControlPanel}
                        style={{ width: '100%', height: '100%' }}
                        autoPlay
                        onPlay={() => {
                            if (!playingState) {
                                setPlayingState(true);
                            }
                        }}
                        onPause={() => {
                            if (playingState) {
                                setPlayingState(false);
                            }
                        }}
                        onTimeUpdate={() => {
                            onProgress(playerRef.current!.currentTime);
                        }}
                        onLoadedMetadata={() => {
                            onTotalTimeChange(playerRef.current!.duration);
                            jumpToHistoryProgress(videoFile);
                        }}
                    />
                </div>
            </div>
        );
    };

    return render();
}
