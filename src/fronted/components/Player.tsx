import React, { ReactElement, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import usePlayerController from '../hooks/usePlayerController';
import useFile from '../hooks/useFile';
import PlayerControlPanel from './PlayerControlPanel';
import { SeekAction } from '../hooks/usePlayerControllerSlices/SliceTypes';
import PlayerSubtitlePanel from '@/fronted/components/playerSubtitle/PlayerSubtitlePanel';
import useLayout from '@/fronted/hooks/useLayout';
import PlaySpeedToaster from '@/fronted/components/PlaySpeedToaster';
import { cn } from '@/fronted/lib/utils';
import PlayerToaster from '@/fronted/components/PlayerToaster';
import UrlUtil from '@/common/utils/UrlUtil';
import StrUtil from '@/common/utils/str-util';

const api = window.electron;

export default function Player({ className }: { className?: string }): ReactElement {
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
        playbackRate
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
            playbackRate: state.playbackRate
        }))
    );
    const videoPath = useFile((s) => s.videoPath);
    const videoId = useFile((s) => s.videoId);
    const loadedVideo = useFile((s) => s.loadedVideo);
    const videoLoaded = useFile((s) => s.videoLoaded);
    const playerRef = useRef<HTMLVideoElement>(null);
    const playerRefBackground = useRef<HTMLCanvasElement>(null);
    let lastFile: string | undefined;

    const fullScreen = useLayout((s) => s.fullScreen);

    const lastSeekTime = useRef<SeekAction>({ time: 0 });
    const lastSeekTimestamp = useRef<number>(0);

    const [showControlPanel, setShowControlPanel] = useState<boolean>(false);

    const podcastMode = useLayout((s) => s.podcastMode);

    const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const performSeek = (time: number) => {
        if (playerRef.current !== null) {
            playerRef.current.currentTime = time;
            playerRef.current.play().catch(error => console.error('Error playing video:', error));
        }
    };

    useEffect(() => {
        if (lastSeekTime.current !== seekTime) {
            const now = Date.now();
            const timeSinceLastSeek = now - lastSeekTimestamp.current;

                // 如果距离上次 seek 小于 200ms，设置延时
                if (seekTimeoutRef.current) {
                    clearTimeout(seekTimeoutRef.current);
                }

                seekTimeoutRef.current = setTimeout(() => {
                    performSeek(seekTime.time);
                    lastSeekTime.current = seekTime;
                    lastSeekTimestamp.current = Date.now();
                    seekTimeoutRef.current = null;
                }, Math.max(0, 200 - timeSinceLastSeek));
        }

        return () => {
            if (seekTimeoutRef.current) {
                clearTimeout(seekTimeoutRef.current);
            }
        };
    }, [seekTime]);

    useEffect(() => {
        if (playerRef.current) {
            playerRef.current.volume = volume;
        }
    }, [volume]);

    useEffect(() => {
        if (playerRef.current) {
            playerRef.current.playbackRate = playbackRate;
        }
    }, [playbackRate]);

    useEffect(() => {
        if (playerRef.current) {
            if (playing) {
                console.log('play');
                playerRef.current.play().catch(error => console.error('Error playing video:', error));
            }
            if (!playing) {
                console.log('pause');
                playerRef.current.pause();
            }
        }
    }, [playing]);

    useEffect(() => {
        const intervalId = setInterval(() => {
            if (playerRef.current) {
                updateExactPlayTime(playerRef.current.currentTime);
            }
        }, 50);

        return () => clearInterval(intervalId);
    }, [updateExactPlayTime]);


    useEffect(() => {
        if (podcastMode) {
            return;
        }
        let animationFrameId: number | undefined;
        let lastDrawTime = Date.now(); // 用来限制绘制的帧率
        const fps = 25; // 把这个调整成需要的帧率

        // 绘制频率的间隔（毫秒）
        const drawInterval = 1000 / fps;

        const syncVideos = async () => {
            const now = Date.now();
            const timeSinceLastDraw = now - lastDrawTime;

            if (timeSinceLastDraw >= drawInterval) {
                const mainVideo = playerRef?.current;
                const backgroundCanvas = playerRefBackground?.current;

                if (
                    mainVideo &&
                    backgroundCanvas &&
                    mainVideo.readyState >= 2
                ) {
                    // 确保视频已经有数据
                    const ctx = backgroundCanvas.getContext('2d');

                    if (ctx) {
                        const { width, height } =
                            backgroundCanvas.getBoundingClientRect();
                        const ratio = window.devicePixelRatio || 1;

                        // 调整目标分辨率的系数，例如变为 1/2
                        const resolutionFactor = 0.1;
                        const scaledWidth = width * ratio * resolutionFactor;
                        const scaledHeight = height * ratio * resolutionFactor;

                        // 设置画布的实际尺寸，即物理尺寸和分辨率
                        backgroundCanvas.width = scaledWidth;
                        backgroundCanvas.height = scaledHeight;

                        // 调整画布绘制尺寸与元素的显示尺寸
                        ctx.scale(
                            ratio * resolutionFactor,
                            ratio * resolutionFactor
                        );

                        try {
                            // 使用 createImageBitmap 改进性能
                            const bitmap = await createImageBitmap(mainVideo);
                            ctx.drawImage(bitmap, 0, 0, width, height);
                            bitmap.close(); // 如果有提供此方法，关闭 bitmap 释放内存
                        } catch (error) {
                            console.error('Error drawing video frame:', error);
                        }

                        // 更新最后绘画时间
                        lastDrawTime = now;
                    }
                }
            }

            // 在下一帧中重新调用 syncVideos
            animationFrameId = requestAnimationFrame(syncVideos);
        };

        if (videoLoaded) {
            syncVideos();
        }

        // 清理操作
        return () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [videoLoaded, playerRef, playerRefBackground, podcastMode]);

    const jumpToHistoryProgress = async (file: string) => {
        if (file === lastFile) {
            return;
        }
        if (videoId === null) {
            return;
        }
        const result = await api.call('watch-project/video/detail', videoId);
        const progress = result.current_time ?? 0;
        console.log('jumpToHistoryProgress', progress);
        seekTo({ time: progress });
        lastFile = file;
    };

    console.log('videoPath', videoPath);
    const render = (): ReactElement => {
        if (StrUtil.isBlank(videoPath)) {
            return <div />;
        }
        return (
            <div
                className={cn('w-full h-full overflow-hidden', className)}
                onMouseLeave={() => setShowControlPanel(false)}
            >
                <div className="w-full h-full relative overflow-hidden">
                    <canvas
                        className="w-full h-full"
                        ref={playerRefBackground}
                        style={{
                            filter: 'blur(100px)',
                            // transform: 'scale(1.1)',
                            objectFit: 'cover'
                        }}
                    />
                    <video
                        ref={playerRef}
                        className="w-full h-full absolute top-0 left-0"
                        src={UrlUtil.file(videoPath)}
                        muted={muted}
                        autoPlay={playing}
                        controls={showControlPanel}
                        // 将视频元素从键盘导航顺序中移除
                        tabIndex={-1}
                        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
                        onLoadedMetadata={async () => {
                            await jumpToHistoryProgress(videoPath);
                            loadedVideo(videoPath);
                        }}
                    />
                    {!fullScreen && (!showControlPanel && (
                        <PlayerControlPanel
                            onTimeChange={(time) => {
                                seekTo({ time });
                            }}
                            className="absolute bottom-0 left-0"
                            onPause={() => {
                                pause();
                            }}
                            onPlay={() => {
                                play();
                            }}
                            playing={playing}
                        />
                    ))}
                    {fullScreen && <PlayerSubtitlePanel />}
                    <PlaySpeedToaster speed={playbackRate} className="absolute top-3 left-3" />
                    <PlayerToaster className="absolute top-3 left-3" />
                </div>
            </div>
        );
    };

    return render();
}

Player.defaultProps = {
    className: ''
};
